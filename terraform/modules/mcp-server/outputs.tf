# MCP Server Module Outputs

output "runtime_id" {
  description = "MCP server runtime ID"
  value       = aws_bedrockagentcore_agent_runtime.mcp_server.agent_runtime_id
}

output "runtime_arn" {
  description = "MCP server runtime ARN"
  value       = aws_bedrockagentcore_agent_runtime.mcp_server.agent_runtime_arn
}

output "endpoint_arn" {
  description = "MCP server endpoint ARN"
  value       = aws_bedrockagentcore_agent_runtime_endpoint.mcp_server.agent_runtime_endpoint_arn
}

output "mcp_url" {
  description = "MCP server URL for client connections"
  value       = "https://bedrock-agentcore.${data.aws_region.current.id}.amazonaws.com/runtimes/${urlencode(aws_bedrockagentcore_agent_runtime.mcp_server.agent_runtime_arn)}/invocations?qualifier=${aws_bedrockagentcore_agent_runtime_endpoint.mcp_server.name}"
}
