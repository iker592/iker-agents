# Data source to get current AWS account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.id
}

# Trust policy for AgentCore runtime execution role
data "aws_iam_policy_document" "runtime_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["bedrock-agentcore.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

# IAM role for the agent runtime
resource "aws_iam_role" "runtime" {
  name               = "${var.agent_name}-runtime-role"
  assume_role_policy = data.aws_iam_policy_document.runtime_assume_role.json
  tags               = var.tags
}

# Policy for Bedrock model invocation
data "aws_iam_policy_document" "bedrock_invoke" {
  statement {
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ]
    resources = [
      "arn:aws:bedrock:*::foundation-model/*",
      "arn:aws:bedrock:*:*:inference-profile/*"
    ]
  }
}

resource "aws_iam_role_policy" "bedrock_invoke" {
  name   = "bedrock-invoke"
  role   = aws_iam_role.runtime.id
  policy = data.aws_iam_policy_document.bedrock_invoke.json
}

# Policy for CloudWatch Logs
data "aws_iam_policy_document" "cloudwatch_logs" {
  statement {
    effect = "Allow"
    actions = [
      "logs:DescribeLogStreams",
      "logs:CreateLogGroup",
      "logs:DescribeLogGroups",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "cloudwatch_logs" {
  name   = "cloudwatch-logs"
  role   = aws_iam_role.runtime.id
  policy = data.aws_iam_policy_document.cloudwatch_logs.json
}

# Policy for X-Ray tracing
data "aws_iam_policy_document" "xray" {
  statement {
    effect = "Allow"
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
      "xray:GetSamplingRules",
      "xray:GetSamplingTargets",
      "xray:GetSamplingStatisticSummaries"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "xray" {
  name   = "xray-tracing"
  role   = aws_iam_role.runtime.id
  policy = data.aws_iam_policy_document.xray.json
}

# Policy for ECR image pull
data "aws_iam_policy_document" "ecr_pull" {
  statement {
    effect = "Allow"
    actions = [
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:BatchCheckLayerAvailability"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ecr_pull" {
  name   = "ecr-pull"
  role   = aws_iam_role.runtime.id
  policy = data.aws_iam_policy_document.ecr_pull.json
}

# Policy for Memory access
# Based on CDK-generated IAM policy for AgentCore Memory
data "aws_iam_policy_document" "memory_access" {
  # Long-term memory read
  statement {
    effect = "Allow"
    actions = [
      "bedrock-agentcore:GetMemoryRecord",
      "bedrock-agentcore:RetrieveMemoryRecords",
      "bedrock-agentcore:ListMemoryRecords",
      "bedrock-agentcore:ListActors",
      "bedrock-agentcore:ListSessions"
    ]
    resources = [aws_bedrockagentcore_memory.this.arn]
  }

  # Short-term memory (events) read
  statement {
    effect = "Allow"
    actions = [
      "bedrock-agentcore:GetEvent",
      "bedrock-agentcore:ListEvents",
      "bedrock-agentcore:ListActors",
      "bedrock-agentcore:ListSessions"
    ]
    resources = [aws_bedrockagentcore_memory.this.arn]
  }

  # Memory write
  statement {
    effect = "Allow"
    actions = [
      "bedrock-agentcore:CreateEvent"
    ]
    resources = [aws_bedrockagentcore_memory.this.arn]
  }
}

resource "aws_iam_role_policy" "memory_access" {
  name   = "memory-access"
  role   = aws_iam_role.runtime.id
  policy = data.aws_iam_policy_document.memory_access.json
}

# Policy for Lambda invocation (for MCP tools)
data "aws_iam_policy_document" "lambda_invoke" {
  statement {
    effect = "Allow"
    actions = [
      "lambda:InvokeFunction"
    ]
    resources = ["arn:aws:lambda:${local.region}:${local.account_id}:function:agentcore-mcp-*"]
  }
}

resource "aws_iam_role_policy" "lambda_invoke" {
  name   = "lambda-invoke"
  role   = aws_iam_role.runtime.id
  policy = data.aws_iam_policy_document.lambda_invoke.json
}

# Policy for MCP Server invocation (AgentCore Runtime)
resource "aws_iam_role_policy" "invoke_mcp_server" {
  count  = var.enable_mcp_server ? 1 : 0
  name   = "invoke-mcp-server"
  role   = aws_iam_role.runtime.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "InvokeMCPServer"
        Effect = "Allow"
        Action = [
          "bedrock-agentcore:InvokeAgentRuntime",
          "bedrock-agentcore:InvokeAgent",
          "bedrock-agentcore:Invoke*"
        ]
        Resource = [
          var.mcp_server_arn,
          "${var.mcp_server_arn}/*"
        ]
      }
    ]
  })
}

# Policy for Code Interpreter invocation
resource "aws_iam_role_policy" "code_interpreter" {
  count  = var.enable_code_interpreter ? 1 : 0
  name   = "code-interpreter"
  role   = aws_iam_role.runtime.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "InvokeCodeInterpreter"
        Effect = "Allow"
        Action = [
          "bedrock-agentcore:InvokeCodeInterpreter",
          "bedrock-agentcore:CreateCodeInterpreterSession",
          "bedrock-agentcore:DeleteCodeInterpreterSession",
          "bedrock-agentcore:GetCodeInterpreterSession"
        ]
        Resource = [
          var.code_interpreter_arn,
          "${var.code_interpreter_arn}/*"
        ]
      }
    ]
  })
}
