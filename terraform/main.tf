# DSP Agent + UI - Terraform deployment

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.id
}

# ============================================================================
# Cognito Authentication (created at root level to avoid circular dependencies)
# Both dsp_agent (JWT auth) and ui (OAuth) modules need Cognito IDs
# ============================================================================

resource "aws_cognito_user_pool" "main" {
  count = var.deploy_ui ? 1 : 0

  name = "agent-ui-tf-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Agent Hub verification code"
    email_message        = "Your verification code is {####}"
  }

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

resource "aws_cognito_user_pool_domain" "main" {
  count = var.deploy_ui ? 1 : 0

  domain       = "agent-ui-tf-${local.account_id}"
  user_pool_id = aws_cognito_user_pool.main[0].id
}

# Cognito client - created at root level for JWT auth
# Callback URLs are updated by UI module after CloudFront is created
resource "aws_cognito_user_pool_client" "main" {
  count = var.deploy_ui ? 1 : 0

  name         = "agent-ui-tf-client"
  user_pool_id = aws_cognito_user_pool.main[0].id

  generate_secret                      = false
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  # Placeholder callback URLs - will be updated by UI module via lifecycle
  # Using localhost for initial deployment
  callback_urls = ["http://localhost:5173/auth/callback"]
  logout_urls   = ["http://localhost:5173"]

  access_token_validity  = 1  # hours
  id_token_validity      = 1  # hours
  refresh_token_validity = 30 # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"

  # Allow callback URLs to be updated externally (by UI module)
  lifecycle {
    ignore_changes = [callback_urls, logout_urls]
  }
}

# DSP Agent module instance
module "dsp_agent" {
  source = "./modules/agent"

  agent_name    = "dsp-agent-tf"
  memory_name   = "dsp_agent_tf_memory"
  runtime_name  = "dsp_agent_tf"
  ecr_image_uri = "${aws_ecr_repository.agent.repository_url}:${var.image_tag}"
  model         = "bedrock:global.anthropic.claude-sonnet-4-5-20250929-v1:0"

  extra_environment_variables = {
    AGENT_NAME = "DSP Agent (Terraform)"
  }

  endpoints = ["dev", "canary", "prod"]

  # JWT auth for direct browser-to-AgentCore streaming (bypasses API Gateway 30s timeout)
  # Uses root-level Cognito to avoid circular dependency with UI module
  cognito_user_pool_id = var.deploy_ui ? aws_cognito_user_pool.main[0].id : ""
  cognito_client_ids   = var.deploy_ui ? [aws_cognito_user_pool_client.main[0].id] : []

  # MCP Server integration - agent invokes MCP server via AgentCore protocol
  mcp_server_arn = var.deploy_mcp_server ? module.mcp_server[0].runtime_arn : ""

  tags = merge(var.tags, {
    Agent = "dsp-agent-tf"
  })

  depends_on = [
    aws_ecr_repository.agent,
    module.mcp_server
  ]
}

# X-Ray resource policies for Transaction Search
# These are global resources - only create if not already present from CDK
# Set create_xray_policies = true if CDK hasn't created them

resource "aws_cloudwatch_log_resource_policy" "xray_logs" {
  count       = var.create_xray_policies ? 1 : 0
  policy_name = "XRaySpansResourcePolicyTF"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowXRayToWriteLogs"
        Effect = "Allow"
        Principal = {
          Service = "xray.amazonaws.com"
        }
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:log-group:aws/spans:*"
      }
    ]
  })
}

resource "aws_xray_resource_policy" "transaction_search" {
  count       = var.create_xray_policies ? 1 : 0
  policy_name = "AWSTransactionSearchConfigurationTF"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "TransactionSearchIndexing"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["xray:IndexSpans"]
        Resource  = "*"
        Condition = {
          StringEquals = {
            "xray:IndexingStrategy" = "Probabilistic"
          }
          NumericLessThanEquals = {
            "xray:ProbabilisticRate" = 0.01
          }
        }
      }
    ]
  })
}

# UI Module - Agent management interface
module "ui" {
  count  = var.deploy_ui ? 1 : 0
  source = "./modules/ui"

  name = "agent-ui-tf"

  runtime_arns = {
    "DSP Agent" = module.dsp_agent.runtime_arn
  }

  ui_dist_path = "${path.root}/../ui/dist"

  # Pass root-level Cognito resources (disable internal Cognito creation)
  enable_auth               = true
  cognito_user_pool_id      = aws_cognito_user_pool.main[0].id
  cognito_user_pool_client_id = aws_cognito_user_pool_client.main[0].id

  tags = merge(var.tags, {
    Component = "ui"
  })

  depends_on = [module.dsp_agent]
}

# Update Cognito client callback URLs after CloudFront is created
resource "null_resource" "update_cognito_callbacks" {
  count = var.deploy_ui ? 1 : 0

  triggers = {
    cloudfront_domain = module.ui[0].cloudfront_domain_name
  }

  provisioner "local-exec" {
    command = <<-EOT
      aws cognito-idp update-user-pool-client \
        --user-pool-id ${aws_cognito_user_pool.main[0].id} \
        --client-id ${aws_cognito_user_pool_client.main[0].id} \
        --callback-urls "https://${module.ui[0].cloudfront_domain_name}" "https://${module.ui[0].cloudfront_domain_name}/auth/callback" \
        --logout-urls "https://${module.ui[0].cloudfront_domain_name}" "https://${module.ui[0].cloudfront_domain_name}/logout" \
        --allowed-o-auth-flows code implicit \
        --allowed-o-auth-scopes email openid profile \
        --allowed-o-auth-flows-user-pool-client \
        --supported-identity-providers COGNITO
    EOT
  }

  depends_on = [module.ui]
}

# Gateway Module - MCP Gateway with Lambda tools
module "gateway" {
  count  = var.deploy_gateway ? 1 : 0
  source = "./modules/gateway"

  name = "agentcore-mcp"

  # Use root-level Cognito auth
  cognito_user_pool_id = var.deploy_ui ? aws_cognito_user_pool.main[0].id : ""
  cognito_client_ids   = var.deploy_ui ? [aws_cognito_user_pool_client.main[0].id] : []

  tags = merge(var.tags, {
    Component = "mcp-gateway"
  })

  depends_on = [module.ui]
}

# MCP Server Module - AgentCore Runtime for MCP Protocol
module "mcp_server" {
  count  = var.deploy_mcp_server ? 1 : 0
  source = "./modules/mcp-server"

  name          = "agentcore_mcp"
  runtime_name  = "mcp_server_tf"
  endpoint_name = "default"
  ecr_image_uri = "${aws_ecr_repository.mcp_server.repository_url}:${var.mcp_server_image_tag}"
  instructions  = "Business tools MCP server with customer, order, and analytics data"

  # Use same Cognito as UI for JWT auth
  cognito_user_pool_id = var.deploy_ui ? aws_cognito_user_pool.main[0].id : ""
  cognito_client_ids   = var.deploy_ui ? [aws_cognito_user_pool_client.main[0].id] : []

  tags = merge(var.tags, {
    Component = "mcp-server"
  })

  depends_on = [aws_ecr_repository.mcp_server]
}
