# MCP Server Module Outputs

output "mcp_lambda_function_name" {
  description = "MCP Server Lambda function name"
  value       = aws_lambda_function.mcp_server.function_name
}

output "mcp_lambda_arn" {
  description = "MCP Server Lambda ARN"
  value       = aws_lambda_function.mcp_server.arn
}

output "mcp_lambda_url" {
  description = "MCP Server Lambda Function URL (for direct invocation)"
  value       = aws_lambda_function_url.mcp_server.function_url
}
