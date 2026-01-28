# DSP Agent - Terraform deployment
# Creates resources alongside CDK with different names to avoid conflicts

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.id
}

# DSP Agent module instance
module "dsp_agent" {
  source = "./modules/agent"

  agent_name    = "dsp-agent-tf"
  memory_name   = "dsp_agent_tf_memory"
  runtime_name  = "dsp_agent_tf"
  ecr_image_uri = var.ecr_image_uri
  model         = "bedrock:global.anthropic.claude-sonnet-4-5-20250929-v1:0"

  extra_environment_variables = {
    AGENT_NAME = "DSP Agent (Terraform)"
  }

  endpoints = ["dev", "canary", "prod"]

  tags = merge(var.tags, {
    Agent = "dsp-agent-tf"
  })
}

# X-Ray resource policies for Transaction Search
# These are global resources - only create if not already present from CDK
# Set create_xray_policies = true if CDK hasn't created them

resource "aws_cloudwatch_log_resource_policy" "xray_logs" {
  count       = var.create_xray_policies ? 1 : 0
  policy_name = "XRaySpansResourcePolicyTF"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowXRayToWriteLogs"
        Effect = "Allow"
        Principal = {
          Service = "xray.amazonaws.com"
        }
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:log-group:aws/spans:*"
      }
    ]
  })
}

resource "aws_xray_resource_policy" "transaction_search" {
  count       = var.create_xray_policies ? 1 : 0
  policy_name = "AWSTransactionSearchConfigurationTF"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "TransactionSearchIndexing"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["xray:IndexSpans"]
        Resource  = "*"
        Condition = {
          StringEquals = {
            "xray:IndexingStrategy" = "Probabilistic"
          }
          NumericLessThanEquals = {
            "xray:ProbabilisticRate" = 0.01
          }
        }
      }
    ]
  })
}
