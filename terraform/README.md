# Terraform Infrastructure for Bedrock AgentCore

This directory contains Terraform configuration for deploying AWS Bedrock AgentCore agents.

## Prerequisites

- Terraform >= 1.5.0
- AWS CLI configured with appropriate credentials
- AWS Provider >= 6.18.0 (for Bedrock AgentCore support)
- Existing ECR image from CDK deployment

## Quick Start

```bash
# Initialize Terraform
cd terraform
terraform init

# Review the plan
terraform plan

# Deploy
terraform apply
```

## Architecture

The Terraform configuration deploys:
- **Memory**: Persistent conversation memory with 90-day event retention
- **Runtime**: Container-based agent runtime with IAM permissions
- **Endpoints**: dev, canary, and prod endpoints for the runtime

## Module Structure

```
terraform/
├── main.tf              # Root module - DSP agent configuration
├── variables.tf         # Input variables
├── outputs.tf           # Stack outputs (CDK-compatible format)
├── versions.tf          # Provider constraints
└── modules/
    └── agent/           # Reusable agent module
        ├── main.tf      # Memory, Runtime, Endpoints
        ├── iam.tf       # IAM roles and policies
        ├── variables.tf # Module inputs
        └── outputs.tf   # Module outputs
```

## Docker Image Strategy

This configuration reuses the CDK-built Docker image from ECR. Update the `ecr_image_uri` variable after each CDK deployment:

```bash
# Get the latest image URI from CDK
aws ecr describe-images \
  --repository-name cdk-hnb659fds-container-assets-<account>-us-east-1 \
  --query 'sort_by(imageDetails,& imagePushedAt)[-1].imageTags[0]' \
  --output text
```

Or pass it as a variable:
```bash
terraform apply -var="ecr_image_uri=<full-image-uri>"
```

## Coexistence with CDK

This Terraform configuration creates resources with different names to avoid conflicts:
- Runtime: `dsp_agent_tf` (vs CDK's `dsp_agent`)
- Memory: `dsp_agent_tf_memory` (vs CDK's `memory`)

Both can be invoked independently:
```bash
# Invoke CDK agent
make invoke INPUT="Hello" STACK=DSPAgentStack

# Invoke Terraform agent (update scripts to read terraform outputs)
# Or use the RuntimeId from `terraform output`
```

## Outputs

Outputs are formatted to be compatible with the existing `cdk-outputs.json` structure:

```bash
# View all outputs
terraform output

# Get specific values
terraform output dsp_agent_runtime_id
terraform output dsp_agent_endpoint_arns

# Export to JSON (for script compatibility)
terraform output -json > terraform-outputs.json
```

## State Management

Currently using local state. For production use, configure an S3 backend:

```hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state-bucket"
    key    = "iker-agents/terraform.tfstate"
    region = "us-east-1"
  }
}
```

## Adding New Agents

1. Create a new module instance in `main.tf`:
   ```hcl
   module "research_agent" {
     source = "./modules/agent"

     agent_name    = "research-agent-tf"
     memory_name   = "research_agent_tf_memory"
     runtime_name  = "research_agent_tf"
     ecr_image_uri = var.ecr_image_uri
     # ... other variables
   }
   ```

2. Add corresponding outputs in `outputs.tf`

3. Run `terraform plan` and `terraform apply`
