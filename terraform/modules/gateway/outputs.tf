# Gateway Module Outputs

output "gateway_id" {
  description = "AgentCore Gateway ID"
  value       = aws_bedrockagentcore_gateway.mcp.gateway_id
}

output "gateway_arn" {
  description = "AgentCore Gateway ARN"
  value       = aws_bedrockagentcore_gateway.mcp.gateway_arn
}

output "gateway_url" {
  description = "Gateway URL for MCP client connections"
  value       = aws_bedrockagentcore_gateway.mcp.gateway_url
}

output "mcp_lambda_arn" {
  description = "MCP Server Lambda ARN"
  value       = aws_lambda_function.mcp_server.arn
}

output "mcp_lambda_function_name" {
  description = "MCP Server Lambda function name"
  value       = aws_lambda_function.mcp_server.function_name
}

output "gateway_target_ids" {
  description = "MCP Tools Gateway Target IDs"
  value = {
    get_customer   = aws_bedrockagentcore_gateway_target.get_customer.target_id
    list_customers = aws_bedrockagentcore_gateway_target.list_customers.target_id
    get_analytics  = aws_bedrockagentcore_gateway_target.get_analytics.target_id
    list_orders    = aws_bedrockagentcore_gateway_target.list_orders.target_id
  }
}
