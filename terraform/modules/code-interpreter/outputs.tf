output "code_interpreter_id" {
  description = "The Code Interpreter ID"
  value       = aws_bedrockagentcore_code_interpreter.this.code_interpreter_id
}

output "code_interpreter_arn" {
  description = "The Code Interpreter ARN"
  value       = aws_bedrockagentcore_code_interpreter.this.code_interpreter_arn
}

output "execution_role_arn" {
  description = "The IAM role ARN for code execution"
  value       = aws_iam_role.code_interpreter.arn
}
