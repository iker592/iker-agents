# Terraform Infrastructure for Bedrock AgentCore

This directory contains Terraform configuration for deploying AWS Bedrock AgentCore agents.

## Prerequisites

- Terraform >= 1.5.0
- AWS CLI configured with appropriate credentials
- AWS Provider >= 6.18.0 (for Bedrock AgentCore support)

## Quick Start

```bash
# Initialize Terraform
cd terraform
terraform init

# Review the plan
terraform plan -var="image_tag=latest"

# Deploy
terraform apply -var="image_tag=<sha>"
```

## Architecture

The Terraform configuration deploys:
- **ECR Repository**: `iker-agents/dsp-agent` - Docker image storage
- **Memory**: Persistent conversation memory with 90-day event retention
- **Runtime**: Container-based agent runtime with IAM permissions
- **Endpoints**: dev, canary, and prod endpoints for the runtime

## Module Structure

```
terraform/
├── main.tf              # Root module - DSP agent configuration
├── variables.tf         # Input variables
├── outputs.tf           # Stack outputs
├── versions.tf          # Provider and backend configuration
├── ecr.tf               # ECR repository
└── modules/
    └── agent/           # Reusable agent module
        ├── main.tf      # Memory, Runtime, Endpoints
        ├── iam.tf       # IAM roles and policies
        ├── variables.tf # Module inputs
        └── outputs.tf   # Module outputs
```

## Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region | `us-east-1` |
| `environment` | Environment name | `dev` |
| `image_tag` | Docker image tag to deploy | `latest` |
| `create_xray_policies` | Create X-Ray policies (false if CDK created them) | `false` |
| `tags` | Default tags for resources | See variables.tf |

## Remote State Backend

Terraform state is stored in S3 with DynamoDB locking for consistency. The backend resources were created manually (one-time setup):

```bash
# S3 bucket for state storage
aws s3api create-bucket --bucket iker-agents-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket iker-agents-terraform-state --versioning-configuration Status=Enabled

# DynamoDB table for state locking
aws dynamodb create-table \
  --table-name iker-agents-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

This enables shared state between local development and CI/CD pipelines.

## CI/CD Workflows

### PR Workflow (`.github/workflows/terraform-pr.yml`)
Runs on PRs that modify `agents/`, `terraform/`, or `Dockerfile`:
1. Lint & Unit Tests
2. Build & Push Docker image (arm64) to ECR
3. Terraform Plan + Apply
4. Promote to Canary
5. Run E2E Tests against Canary
6. Promote to Prod

### Merge Workflow (`.github/workflows/terraform-merge.yml`)
Runs on merge to main:
1. Build & Push Docker image
2. Terraform Apply
3. Promote all endpoints (Canary + Prod)

## Deployment Timing

Based on local testing:
- Docker build + push (arm64): ~61 seconds
- Terraform apply (runtime update): ~12 seconds
- **Total**: ~73 seconds for a full deployment

## Coexistence with CDK

This Terraform configuration creates resources with different names to avoid conflicts:
- Runtime: `dsp_agent_tf` (vs CDK's `dsp_agent`)
- Memory: `dsp_agent_tf_memory` (vs CDK's `memory`)

Both can be invoked independently:
```bash
# Invoke CDK agent
make invoke INPUT="Hello" STACK=DSPAgentStack

# Invoke Terraform agent
AGENT_RUNTIME_ARN="$(terraform output -raw dsp_agent_runtime_arn)" \
AGENT_ENDPOINT=dev \
uv run python scripts/invoke.py "Hello"
```

## Outputs

```bash
# View all outputs
terraform output

# Get specific values
terraform output dsp_agent_runtime_id
terraform output dsp_agent_endpoint_arns

# Export to JSON
terraform output -json > terraform-outputs.json
```

## Adding New Agents

1. Create a new module instance in `main.tf`:
   ```hcl
   module "research_agent" {
     source = "./modules/agent"

     agent_name    = "research-agent-tf"
     memory_name   = "research_agent_tf_memory"
     runtime_name  = "research_agent_tf"
     ecr_image_uri = "${aws_ecr_repository.agent.repository_url}:${var.image_tag}"
     # ... other variables
   }
   ```

2. Add corresponding outputs in `outputs.tf`

3. Run `terraform plan` and `terraform apply`
