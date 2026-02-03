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

# Research Agent outputs
output "research_agent_runtime_arn" {
  description = "The Research agent runtime ARN"
  value       = var.deploy_research_agent ? module.research_agent[0].runtime_arn : null
}

output "research_agent_runtime_id" {
  description = "The Research agent runtime ID"
  value       = var.deploy_research_agent ? module.research_agent[0].runtime_id : null
}

output "research_agent_memory_id" {
  description = "The Research agent memory ID"
  value       = var.deploy_research_agent ? module.research_agent[0].memory_id : null
}

# Coding Agent outputs
output "coding_agent_runtime_arn" {
  description = "The Coding agent runtime ARN"
  value       = var.deploy_coding_agent ? module.coding_agent[0].runtime_arn : null
}

output "coding_agent_runtime_id" {
  description = "The Coding agent runtime ID"
  value       = var.deploy_coding_agent ? module.coding_agent[0].runtime_id : null
}

output "coding_agent_memory_id" {
  description = "The Coding agent memory ID"
  value       = var.deploy_coding_agent ? module.coding_agent[0].memory_id : null
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

# MCP Server Runtime outputs
output "mcp_server_runtime_id" {
  description = "MCP server runtime ID"
  value       = var.deploy_mcp_server ? module.mcp_server[0].runtime_id : null
}

output "mcp_server_runtime_arn" {
  description = "MCP server runtime ARN"
  value       = var.deploy_mcp_server ? module.mcp_server[0].runtime_arn : null
}

output "mcp_server_endpoint_arn" {
  description = "MCP server endpoint ARN"
  value       = var.deploy_mcp_server ? module.mcp_server[0].endpoint_arn : null
}

output "mcp_server_url" {
  description = "MCP server URL for client connections"
  value       = var.deploy_mcp_server ? module.mcp_server[0].mcp_url : null
}
