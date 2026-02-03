# AWS Bedrock AgentCore Code Interpreter
# Provides a managed sandbox environment for executing code

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.id
}

# IAM Role for Code Interpreter execution
resource "aws_iam_role" "code_interpreter" {
  name = "${var.name}-code-interpreter-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "bedrock-agentcore.amazonaws.com"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = local.account_id
          }
          ArnLike = {
            "aws:SourceArn" = "arn:aws:bedrock-agentcore:${local.region}:${local.account_id}:*"
          }
        }
      }
    ]
  })

  tags = var.tags
}

# Basic permissions for code execution
resource "aws_iam_role_policy" "code_interpreter" {
  name = "code-interpreter-execution"
  role = aws_iam_role.code_interpreter.id

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
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/bedrock-agentcore/*"
      },
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.name}-code-interpreter-*",
          "arn:aws:s3:::${var.name}-code-interpreter-*/*"
        ]
      }
    ]
  })
}

# Code Interpreter resource
resource "aws_bedrockagentcore_code_interpreter" "this" {
  name               = var.name
  description        = var.description
  execution_role_arn = aws_iam_role.code_interpreter.arn

  network_configuration {
    network_mode = var.network_mode
  }

  tags = var.tags
}
