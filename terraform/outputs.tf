# Outputs in a format compatible with existing scripts
# Can be written to terraform-outputs.json for script consumption

output "DSPAgentStackTF" {
  description = "DSP Agent (Terraform) stack outputs - compatible with CDK output format"
  value = {
    RuntimeArn       = module.dsp_agent.runtime_arn
    RuntimeId        = module.dsp_agent.runtime_id
    MemoryId         = module.dsp_agent.memory_id
    DevEndpointArn   = module.dsp_agent.endpoint_arns["dev"]
    CanaryEndpointArn = module.dsp_agent.endpoint_arns["canary"]
    ProdEndpointArn  = module.dsp_agent.endpoint_arns["prod"]
  }
}

# Individual outputs for easy access
output "dsp_agent_runtime_arn" {
  description = "The DSP agent runtime ARN"
  value       = module.dsp_agent.runtime_arn
}

output "dsp_agent_runtime_id" {
  description = "The DSP agent runtime ID"
  value       = module.dsp_agent.runtime_id
}

output "dsp_agent_memory_id" {
  description = "The DSP agent memory ID"
  value       = module.dsp_agent.memory_id
}

output "dsp_agent_endpoint_arns" {
  description = "Map of DSP agent endpoint names to ARNs"
  value       = module.dsp_agent.endpoint_arns
}

# UI outputs
output "ui_url" {
  description = "UI CloudFront URL"
  value       = var.deploy_ui ? module.ui[0].ui_url : null
}

output "ui_api_url" {
  description = "UI API Gateway URL"
  value       = var.deploy_ui ? module.ui[0].api_url : null
}

output "ui_bucket_name" {
  description = "UI S3 bucket name"
  value       = var.deploy_ui ? module.ui[0].bucket_name : null
}

output "ui_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = var.deploy_ui ? module.ui[0].cloudfront_distribution_id : null
}

# Auth outputs (from root-level Cognito resources)
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = var.deploy_ui ? aws_cognito_user_pool.main[0].id : null
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = var.deploy_ui ? aws_cognito_user_pool_client.main[0].id : null
}

output "cognito_domain" {
  description = "Cognito hosted UI domain for OAuth"
  value       = var.deploy_ui ? "https://${aws_cognito_user_pool_domain.main[0].domain}.auth.${local.region}.amazoncognito.com" : null
}

# AgentCore direct access (for frontend streaming)
output "agentcore_endpoint" {
  description = "AgentCore service endpoint for direct browser-to-AgentCore streaming"
  value       = "https://bedrock-agentcore.${local.region}.amazonaws.com"
}

# MCP Gateway outputs
output "mcp_gateway_url" {
  description = "MCP Gateway URL for client connections"
  value       = var.deploy_gateway ? module.gateway[0].gateway_url : null
}

output "mcp_gateway_id" {
  description = "MCP Gateway ID"
  value       = var.deploy_gateway ? module.gateway[0].gateway_id : null
}

output "mcp_lambda_arn" {
  description = "MCP Lambda ARN"
  value       = var.deploy_gateway ? module.gateway[0].mcp_lambda_arn : null
}

# MCP Server Runtime outputs (disabled - using Lambda instead)
# output "mcp_server_runtime_id" { ... }
# output "mcp_server_runtime_arn" { ... }
# output "mcp_server_url" { ... }
