# Multi-Agent Platform

A serverless multi-agent platform built with **AWS Bedrock AgentCore** + **Strands Agents** + **Terraform**.

Features:
- **3 Specialized Agents**: DSP (business tools), Research, Coding
- **MCP Server**: Business tools via Model Context Protocol
- **React UI**: Real-time streaming with AG-UI protocol
- **Fully Managed**: AWS handles scaling, auth, observability

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI (React)                               │
│  - Agent selector dropdown                                       │
│  - Real-time streaming via AG-UI protocol                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Bedrock AgentCore                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ DSP Agent   │  │  Research   │  │   Coding    │              │
│  │             │  │   Agent     │  │    Agent    │              │
│  │ MCP Tools   │  │ calculator  │  │ calculator  │              │
│  │             │  │ http_request│  │ CodeInterp  │              │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘              │
│         │                                  │                     │
│         ▼                                  ▼                     │
│  ┌─────────────┐                   ┌─────────────┐              │
│  │ MCP Server  │                   │    Code     │              │
│  │ (Runtime)   │                   │ Interpreter │              │
│  └─────────────┘                   │  (Managed)  │              │
│                                    └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start (Local Development)

```bash
# Setup (installs uv, syncs deps)
make setup

# Run locally (in-memory state)
make local

# Run specific agent
make local-agent AGENT=dsp|research|coding

# Test it
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello!", "user_id": "test", "session_id": "test-session-12345678901234567890"}'
```

## Prerequisites

- **Python 3.13+**
- **[uv](https://github.com/astral-sh/uv)** - Fast Python package manager
- **Docker** - For containerized builds
- **AWS CLI v2** - Configured with credentials
- **Terraform 1.5+** - Infrastructure as Code
- **Node.js 20+** - For UI development

## Fork Setup Guide

Follow these steps to deploy this platform to your own AWS account.

### Step 1: Fork the Repository

```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/iker-agents.git
cd iker-agents
```

### Step 2: AWS Account Setup

#### 2.1 Enable Bedrock Model Access

1. Go to **AWS Console → Amazon Bedrock → Model access**
2. Request access to:
   - `anthropic.claude-3-5-sonnet-20241022-v2:0`
   - `anthropic.claude-3-5-haiku-20241022-v1:0`
3. Wait for approval (usually instant for Claude models)

#### 2.2 Enable Bedrock AgentCore

AgentCore is in preview. You may need to:
1. Request access via AWS Console or your AWS account team
2. Ensure your region supports AgentCore (us-east-1, us-west-2)

### Step 3: GitHub OIDC Setup (for CI/CD)

Create an IAM role that GitHub Actions can assume.

#### 3.1 Create OIDC Provider

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

#### 3.2 Create IAM Role

Create `github-actions-role.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/iker-agents:*"
        }
      }
    }
  ]
}
```

```bash
# Create the role
aws iam create-role \
  --role-name GitHubActions-iker-agents \
  --assume-role-policy-document file://github-actions-role.json

# Attach policies (adjust based on your security requirements)
aws iam attach-role-policy \
  --role-name GitHubActions-iker-agents \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

#### 3.3 Update GitHub Workflow

Edit `.github/workflows/terraform-merge.yml` and `.github/workflows/terraform-pr.yml`:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-iker-agents
    aws-region: us-east-1
```

### Step 4: Terraform Backend Setup

#### 4.1 Create S3 Bucket for State

```bash
# Create bucket (use a unique name)
aws s3 mb s3://YOUR_UNIQUE_BUCKET-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket YOUR_UNIQUE_BUCKET-terraform-state \
  --versioning-configuration Status=Enabled
```

#### 4.2 Create DynamoDB Table for Locking

```bash
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

#### 4.3 Update Backend Configuration

Edit `terraform/backend.tf`:
```hcl
terraform {
  backend "s3" {
    bucket         = "YOUR_UNIQUE_BUCKET-terraform-state"
    key            = "iker-agents/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

### Step 5: Configure Terraform Variables

Create `terraform/terraform.tfvars`:
```hcl
# Required
aws_region = "us-east-1"

# Feature flags (all default to true)
deploy_ui             = true
deploy_gateway        = true
deploy_mcp_server     = true
deploy_research_agent = true
deploy_coding_agent   = true

# Tags
tags = {
  Project     = "iker-agents"
  Environment = "dev"
  ManagedBy   = "terraform"
}
```

### Step 6: Initial Deployment

```bash
cd terraform

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Deploy (this creates ECR repos, then you need to push images)
terraform apply -target=aws_ecr_repository.agent \
                -target=aws_ecr_repository.research_agent \
                -target=aws_ecr_repository.coding_agent \
                -target=aws_ecr_repository.mcp_server

# Build and push images manually for first deployment
# (After this, CI/CD handles it)
```

### Step 7: Build and Push Docker Images

```bash
# Authenticate to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push DSP Agent
docker build -t YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iker-agents/dsp-agent:latest \
  --build-arg AGENT_PATH=./agents/dsp .
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iker-agents/dsp-agent:latest

# Build and push Research Agent
docker build -t YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iker-agents/research-agent:latest \
  --build-arg AGENT_PATH=./agents/research .
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iker-agents/research-agent:latest

# Build and push Coding Agent
docker build -t YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iker-agents/coding-agent:latest \
  --build-arg AGENT_PATH=./agents/coding .
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iker-agents/coding-agent:latest

# Build and push MCP Server
docker build -t YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iker-agents/mcp-server:latest \
  -f agents/mcp-server/Dockerfile agents/mcp-server
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/iker-agents/mcp-server:latest
```

### Step 8: Complete Terraform Deployment

```bash
cd terraform

# Deploy everything
terraform apply

# Note the outputs
terraform output
```

### Step 9: Build and Deploy UI

```bash
cd ui

# Install dependencies
npm install

# Create .env file with Terraform outputs
cat > .env << EOF
VITE_API_URL=$(cd ../terraform && terraform output -raw ui_api_url)
VITE_COGNITO_USER_POOL_ID=$(cd ../terraform && terraform output -raw cognito_user_pool_id)
VITE_COGNITO_CLIENT_ID=$(cd ../terraform && terraform output -raw cognito_user_pool_client_id)
VITE_COGNITO_DOMAIN=$(cd ../terraform && terraform output -raw cognito_domain)
VITE_AGENTCORE_ENDPOINT=$(cd ../terraform && terraform output -raw agentcore_endpoint)
EOF

# Build
npm run build

# Deploy to S3
aws s3 sync dist/ s3://$(cd ../terraform && terraform output -raw ui_bucket_name) --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $(cd ../terraform && terraform output -raw ui_cloudfront_distribution_id) \
  --paths "/*"
```

### Step 10: Create a Test User

```bash
# Create user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id $(terraform output -raw cognito_user_pool_id) \
  --username your@email.com \
  --user-attributes Name=email,Value=your@email.com \
  --temporary-password TempPass123!

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $(terraform output -raw cognito_user_pool_id) \
  --username your@email.com \
  --password YourSecurePassword123! \
  --permanent
```

### Step 11: Access the UI

```bash
# Get the UI URL
terraform output ui_url
```

Open the URL, log in with your Cognito user, and start chatting with the agents!

---

## Project Structure

```
.
├── agents/                      # Agent implementations
│   ├── dsp/                     # DSP Agent (business tools)
│   │   ├── main.py              # BedrockAgentCoreApp entrypoint
│   │   ├── agent.py             # Agent creation with tools
│   │   ├── mcp_client.py        # MCP server client
│   │   ├── mcp_tools.py         # Tool wrappers
│   │   └── settings.py          # Pydantic settings
│   ├── research/                # Research Agent
│   ├── coding/                  # Coding Agent
│   └── mcp-server/              # MCP Server (FastMCP)
│       ├── server.py            # MCP server implementation
│       └── Dockerfile
├── agent-sdk/                   # Yahoo DSP Agent SDK (editable dep)
├── ui/                          # React frontend
│   ├── src/
│   │   ├── pages/Chat.tsx       # Main chat interface
│   │   ├── services/api.ts      # AgentCore client
│   │   └── hooks/useAgents.ts   # Agent list hook
│   └── package.json
├── terraform/                   # Infrastructure as Code
│   ├── main.tf                  # Root module
│   ├── ecr.tf                   # ECR repositories
│   ├── outputs.tf               # Stack outputs
│   ├── variables.tf             # Input variables
│   └── modules/
│       ├── agent/               # AgentCore Runtime module
│       ├── mcp-server/          # MCP Server module
│       ├── ui/                  # UI (S3 + CloudFront)
│       ├── gateway/             # API Gateway
│       └── code-interpreter/    # Code Interpreter
├── .github/workflows/
│   ├── terraform-merge.yml      # Main branch CI/CD
│   └── terraform-pr.yml         # PR validation
├── Dockerfile                   # Agent container
├── Makefile                     # Task automation
└── pyproject.toml               # Python dependencies
```

## Development Commands

```bash
# Setup & Dependencies
make setup              # Install uv and sync dependencies
make sync               # Sync dependencies with uv
make aws-auth           # Setup AWS authentication

# Code Quality
make lint               # Check code with ruff
make format             # Format code with ruff
make fix                # Auto-fix linting issues
make check              # Run all checks (pre-commit)

# Testing
make test               # Run all tests
make test-unit          # Run unit tests only
make test-e2e           # Run e2e tests (requires deployed agent)

# Local Development
make local              # Run agent locally (in-memory)
make local MEMORY_ID=x  # Run with AWS memory persistence
make local-agent AGENT=dsp|research|coding

# Docker Development
make build              # Build Docker image
make start              # Start container (detached)
make dev                # Hot reload mode
make logs               # View container logs

# Deployment
make deploy             # Deploy via Terraform
make invoke INPUT="Hi"  # Invoke deployed agent
make invoke-stream      # Stream response
```

## Environment Variables

### Agent Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MODEL` | Bedrock model ID | Set by Terraform |
| `AWS_REGION` | AWS region | `us-east-1` |
| `MEMORY_ID` | AgentCore Memory ID | Set by Terraform |
| `MCP_SERVER_ARN` | MCP Server runtime ARN | Set by Terraform |
| `CODE_INTERPRETER_ID` | Code Interpreter ID | Set by Terraform (Coding Agent only) |

### UI Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API Gateway URL |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_COGNITO_DOMAIN` | Cognito hosted UI domain |
| `VITE_AGENTCORE_ENDPOINT` | AgentCore endpoint for streaming |

## CI/CD Pipeline

### On Push to Main

1. **Lint & Test** - Ruff + pytest
2. **Build Images** - All 4 Docker images in parallel
3. **Terraform Deploy** - Infrastructure + agent runtimes
4. **Deploy UI** - S3 sync + CloudFront invalidation
5. **Promote to Canary** - All 3 agents
6. **E2E Tests** - Against canary endpoints
7. **Promote to Prod** - On test success

### On Pull Request

1. **Lint & Test** - Ruff + pytest
2. **Build Images** - Validate all images build
3. **Terraform Plan** - Preview infrastructure changes
4. **Comment PR** - Post plan summary

## Troubleshooting

### "Permission denied: /app/repl_state"
The `python_repl` tool needs a writable directory. This is fixed in the Dockerfile but if you see this error, ensure the Coding Agent uses `AgentCoreCodeInterpreter` instead.

### Agent returns 424 "Failed Dependency"
Check CloudWatch logs:
```bash
aws logs tail "/aws/bedrock-agentcore/runtimes/YOUR_RUNTIME_NAME-DEFAULT" --since 10m
```

### All agents respond the same way
Ensure UI passes the selected agent's `runtime_arn` to `invokeAgentDirect()`. Check `ui/src/pages/Chat.tsx`.

### MCP tool calls fail
1. Check agent IAM role has `bedrock-agentcore:InvokeAgentRuntime` permission
2. Verify MCP server is deployed: `terraform output mcp_server_runtime_arn`

## Resources

- [Strands Agents Documentation](https://strandsagents.com/)
- [AWS Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/)
- [AgentCore Code Interpreter](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-tool.html)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [AG-UI Protocol](https://docs.ag-ui.com/)

## License

MIT
