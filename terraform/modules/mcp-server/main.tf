# MCP Server Module - AgentCore Runtime for MCP Protocol
# Deploys FastMCP server as a standalone AgentCore Runtime

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.id
}

# ============================================================================
# IAM Roles
# ============================================================================

# Runtime Execution Role
resource "aws_iam_role" "runtime" {
  name = "${var.name}-runtime-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock-agentcore.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Runtime execution policy - CloudWatch, X-Ray
resource "aws_iam_role_policy" "runtime_execution" {
  name = "runtime-execution"
  role = aws_iam_role.runtime.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid    = "XRay"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRAccess"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

# ============================================================================
# AgentCore Runtime for MCP Server
# ============================================================================

resource "aws_bedrockagentcore_agent_runtime" "mcp_server" {
  agent_runtime_name = var.runtime_name
  role_arn           = aws_iam_role.runtime.arn

  network_configuration {
    network_mode = "PUBLIC"
  }

  runtime_artifacts {
    container {
      container_uri = var.ecr_image_uri
    }
  }

  protocol_configuration {
    mcp {
      instructions = var.instructions
    }
  }

  # Authorizer - use custom JWT if Cognito is configured
  dynamic "authorizer_configuration" {
    for_each = var.cognito_user_pool_id != "" ? [1] : []
    content {
      custom_jwt_authorizer {
        discovery_url   = "https://cognito-idp.${local.region}.amazonaws.com/${var.cognito_user_pool_id}/.well-known/openid-configuration"
        allowed_clients = var.cognito_client_ids
      }
    }
  }

  tags = var.tags
}

# Runtime Endpoint
resource "aws_bedrockagentcore_runtime_endpoint" "mcp_server" {
  runtime_endpoint_name = var.endpoint_name
  runtime_id            = aws_bedrockagentcore_agent_runtime.mcp_server.agent_runtime_id
  description           = "MCP Server endpoint"

  tags = var.tags
}
