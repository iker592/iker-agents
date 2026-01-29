# Bedrock AgentCore Memory
resource "aws_bedrockagentcore_memory" "this" {
  name                  = var.memory_name
  event_expiry_duration = var.memory_event_expiry_days

  tags = var.tags
}

# Bedrock AgentCore Agent Runtime
resource "aws_bedrockagentcore_agent_runtime" "this" {
  agent_runtime_name = var.runtime_name
  description        = "Agent runtime for ${var.agent_name} - managed by Terraform"
  role_arn           = aws_iam_role.runtime.arn

  network_configuration {
    network_mode = "PUBLIC"
  }

  agent_runtime_artifact {
    container_configuration {
      container_uri = var.ecr_image_uri
    }
  }

  # JWT Authorization - enables direct browser-to-AgentCore streaming (bypasses API Gateway 30s timeout)
  dynamic "authorizer_configuration" {
    for_each = var.cognito_user_pool_id != "" ? [1] : []
    content {
      custom_jwt_authorizer {
        discovery_url   = "https://cognito-idp.${local.region}.amazonaws.com/${var.cognito_user_pool_id}/.well-known/openid-configuration"
        allowed_clients = var.cognito_client_ids
      }
    }
  }

  environment_variables = merge(
    {
      AWS_REGION = local.region
      MEMORY_ID  = aws_bedrockagentcore_memory.this.id
      MODEL      = var.model
    },
    var.mcp_server_arn != "" ? { MCP_SERVER_ARN = var.mcp_server_arn } : {},
    var.extra_environment_variables
  )

  tags = var.tags

  depends_on = [
    aws_iam_role_policy.bedrock_invoke,
    aws_iam_role_policy.cloudwatch_logs,
    aws_iam_role_policy.xray,
    aws_iam_role_policy.ecr_pull,
    aws_iam_role_policy.memory_access
  ]
}

# Bedrock AgentCore Runtime Endpoints
resource "aws_bedrockagentcore_agent_runtime_endpoint" "this" {
  for_each = toset(var.endpoints)

  agent_runtime_id = aws_bedrockagentcore_agent_runtime.this.agent_runtime_id
  name             = each.value
  description      = "${var.agent_name} - ${title(each.value)} endpoint"

  tags = var.tags
}
