output "memory_id" {
  description = "The memory ID"
  value       = aws_bedrockagentcore_memory.this.id
}

output "memory_arn" {
  description = "The memory ARN"
  value       = aws_bedrockagentcore_memory.this.arn
}

output "runtime_id" {
  description = "The agent runtime ID"
  value       = aws_bedrockagentcore_agent_runtime.this.agent_runtime_id
}

output "runtime_arn" {
  description = "The agent runtime ARN"
  value       = aws_bedrockagentcore_agent_runtime.this.agent_runtime_arn
}

output "runtime_role_arn" {
  description = "The IAM role ARN for the runtime"
  value       = aws_iam_role.runtime.arn
}

output "endpoint_arns" {
  description = "Map of endpoint names to their ARNs"
  value = {
    for k, v in aws_bedrockagentcore_agent_runtime_endpoint.this : k => v.agent_runtime_endpoint_arn
  }
}

output "endpoint_names" {
  description = "Map of endpoint names to their names"
  value = {
    for k, v in aws_bedrockagentcore_agent_runtime_endpoint.this : k => v.name
  }
}
