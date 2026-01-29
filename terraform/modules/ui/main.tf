# UI Module - S3 + Lambda Proxy + API Gateway + CloudFront

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.id
}

# S3 Bucket for static UI hosting
resource "aws_s3_bucket" "ui" {
  bucket = "${var.name}-${local.account_id}"

  tags = var.tags
}

resource "aws_s3_bucket_website_configuration" "ui" {
  bucket = aws_s3_bucket.ui.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "ui" {
  bucket = aws_s3_bucket.ui.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "ui" {
  bucket = aws_s3_bucket.ui.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.ui.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.ui]
}

# Lambda execution role
resource "aws_iam_role" "lambda" {
  name = "${var.name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "lambda_logs" {
  name = "lambda-logs"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_agentcore" {
  name = "agentcore-invoke"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "bedrock-agentcore:InvokeAgentRuntime"
        Resource = "*"
      }
    ]
  })
}

# Lambda function
resource "aws_lambda_function" "proxy" {
  function_name = "${var.name}-proxy"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "python3.13"
  timeout       = 300

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  environment {
    variables = {
      RUNTIME_ARNS = jsonencode(var.runtime_arns)
    }
  }

  tags = var.tags
}

data "archive_file" "lambda" {
  type        = "zip"
  output_path = "${path.module}/lambda.zip"

  source {
    content  = <<-EOF
import json
import boto3
import os
import uuid
from typing import Any

client = boto3.client('bedrock-agentcore')

# Runtime ARNs from environment
RUNTIME_ARNS = json.loads(os.environ.get('RUNTIME_ARNS', '{}'))

def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Proxy requests to Bedrock AgentCore runtimes."""

    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Content-Type': 'application/json'
    }

    # Handle preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        # Support both API Gateway v1 (REST) and v2 (HTTP) payload formats
        path = event.get('rawPath') or event.get('path', '')
        method = event.get('requestContext', {}).get('http', {}).get('method') or event.get('httpMethod', 'GET')
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}

        # Build ID-to-ARN mapping (convert name to lowercase-dash ID)
        def get_agent_id(name):
            return name.lower().replace(' ', '-')

        AGENT_ID_TO_ARN = {get_agent_id(name): arn for name, arn in RUNTIME_ARNS.items()}
        AGENT_ID_TO_NAME = {get_agent_id(name): name for name in RUNTIME_ARNS.keys()}

        # GET /agents - List available agents
        if path == '/agents' and method == 'GET':
            agents = []
            for name, arn in RUNTIME_ARNS.items():
                agents.append({
                    'id': get_agent_id(name),
                    'name': name,
                    'runtime_arn': arn,
                    'status': 'active'
                })

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'agents': agents})
            }

        # POST /invoke - Invoke an agent
        if path == '/invoke' and method == 'POST':
            agent_id = body.get('agent_id')
            input_text = body.get('input', '')
            # Generate session ID with minimum 33 chars (uuid.hex = 32 chars)
            session_id = body.get('session_id') or f"s-{uuid.uuid4().hex}"

            # Extract authenticated user from JWT claims (set by API Gateway authorizer)
            # Falls back to body.user_id or default for unauthenticated requests
            jwt_claims = event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {})
            user_id = jwt_claims.get('sub') or jwt_claims.get('email') or body.get('user_id', 'anonymous-user')

            # Log authenticated user for audit
            if jwt_claims:
                print(f"Authenticated request from user: {user_id}")

            if not agent_id or agent_id not in AGENT_ID_TO_ARN:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': f'Invalid agent_id: {agent_id}',
                        'available': list(AGENT_ID_TO_ARN.keys())
                    })
                }

            runtime_arn = AGENT_ID_TO_ARN[agent_id]

            # Build payload for AgentCore
            payload = {
                'input': input_text,
                'user_id': user_id,
                'session_id': session_id,
                'stream': False
            }

            # Invoke AgentCore runtime
            invoke_params = {
                'agentRuntimeArn': runtime_arn,
                'runtimeSessionId': session_id,
                'payload': json.dumps(payload)
            }

            response = client.invoke_agent_runtime(**invoke_params)

            # Parse non-streaming response
            response_body = response['response'].read()
            response_data = json.loads(response_body)

            # Log full response for debugging
            print(f"AgentCore response: {json.dumps(response_data)}")

            # Extract output from response (structure may vary)
            output = response_data.get('output', '')
            if not output and 'text' in response_data:
                output = response_data['text']
            if not output and 'content' in response_data:
                output = response_data['content']
            if not output:
                # If still no output, return the whole response for debugging
                output = json.dumps(response_data)

            result = {
                'output': output,
                'session_id': session_id,
            }

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(result)
            }

        # Default 404
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Not found'})
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error: {error_details}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e), 'details': error_details})
        }
EOF
    filename = "index.py"
  }
}

# Cognito User Pool for authentication
resource "aws_cognito_user_pool" "pool" {
  count = var.enable_auth ? 1 : 0

  name = "${var.name}-users"

  # Username attributes
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # User verification
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Agent Hub verification code"
    email_message        = "Your verification code is {####}"
  }

  # Schema attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    mutable             = true
    required            = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  tags = var.tags
}

resource "aws_cognito_user_pool_client" "client" {
  count = var.enable_auth ? 1 : 0

  name         = "${var.name}-client"
  user_pool_id = aws_cognito_user_pool.pool[0].id

  # OAuth settings
  generate_secret                      = false
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  # Callback URLs - include CloudFront domain
  callback_urls = length(var.callback_urls) > 0 ? var.callback_urls : [
    "https://${aws_cloudfront_distribution.ui.domain_name}",
    "https://${aws_cloudfront_distribution.ui.domain_name}/auth/callback"
  ]

  logout_urls = length(var.logout_urls) > 0 ? var.logout_urls : [
    "https://${aws_cloudfront_distribution.ui.domain_name}",
    "https://${aws_cloudfront_distribution.ui.domain_name}/logout"
  ]

  # Token validity
  access_token_validity  = 1  # hours
  id_token_validity      = 1  # hours
  refresh_token_validity = 30 # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"
}

resource "aws_cognito_user_pool_domain" "domain" {
  count = var.enable_auth ? 1 : 0

  domain       = "${var.name}-${local.account_id}"
  user_pool_id = aws_cognito_user_pool.pool[0].id
}

# API Gateway
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = var.enable_auth ? ["https://${aws_cloudfront_distribution.ui.domain_name}"] : ["*"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization"]
    allow_credentials = var.enable_auth
  }

  tags = var.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

# JWT Authorizer for Cognito
resource "aws_apigatewayv2_authorizer" "jwt" {
  count = var.enable_auth ? 1 : 0

  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.client[0].id]
    issuer   = "https://cognito-idp.${local.region}.amazonaws.com/${aws_cognito_user_pool.pool[0].id}"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.proxy.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "agents" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /agents"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  # Agents list is public - no auth required
}

resource "aws_apigatewayv2_route" "invoke" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "POST /invoke"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = var.enable_auth ? "JWT" : "NONE"
  authorizer_id      = var.enable_auth ? aws_apigatewayv2_authorizer.jwt[0].id : null
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.proxy.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "ui" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name = aws_s3_bucket_website_configuration.ui.website_endpoint
    origin_id   = "S3-Website"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-Website"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA routing - return index.html for 404s
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = var.tags
}
