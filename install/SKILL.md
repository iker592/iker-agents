---
name: install
description: Interactive setup wizard for deploying this multi-agent platform to your AWS account. Guides you through configuration, makes code changes, and helps you open your first PR.
metadata:
  author: iker-agents
  version: "1.0"
---

# Installation Wizard Skill

You are helping a user set up this multi-agent platform in their own AWS account. Guide them through the process interactively by asking questions and making the necessary code changes.

## Overview

The setup process involves:
1. Collecting configuration (AWS account, GitHub username, etc.)
2. Modifying local files (terraform backend, GitHub workflows)
3. Guiding AWS resource creation (OIDC, IAM role, S3, DynamoDB)
4. Creating their first PR to trigger CI/CD

## Step 1: Collect Information

Ask the user these questions ONE AT A TIME. Wait for each answer before proceeding.

### Question 1: AWS Account ID
```
What is your AWS Account ID? (12-digit number, e.g., 123456789012)

You can find it by running: aws sts get-caller-identity --query Account --output text
```

### Question 2: GitHub Username
```
What is your GitHub username? (This should match your fork, e.g., if your fork is
github.com/johndoe/iker-agents, your username is "johndoe")
```

### Question 3: AWS Region
```
Which AWS region do you want to deploy to?

Options:
1. us-east-1 (recommended - best AgentCore support)
2. us-west-2

Default: us-east-1
```

### Question 4: Terraform State Bucket Name
```
What name would you like for your Terraform state S3 bucket?

Suggestion: {username}-iker-agents-tf-state

Note: S3 bucket names must be globally unique.
```

## Step 2: Update Configuration Files

After collecting all information, make these changes:

### 2.1 Update terraform/backend.tf

```hcl
terraform {
  backend "s3" {
    bucket         = "{BUCKET_NAME}"
    key            = "iker-agents/terraform.tfstate"
    region         = "{REGION}"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

### 2.2 Update .github/workflows/terraform-merge.yml

Find and replace the role ARN:
```yaml
role-to-assume: arn:aws:iam::{ACCOUNT_ID}:role/GitHubActions-iker-agents
aws-region: {REGION}
```

Also update the ECR registry in all image build/push steps:
```yaml
{ACCOUNT_ID}.dkr.ecr.{REGION}.amazonaws.com/iker-agents/...
```

### 2.3 Update .github/workflows/terraform-pr.yml

Same changes as terraform-merge.yml:
- Role ARN
- ECR registry URLs
- Region

### 2.4 Create terraform/terraform.tfvars (if doesn't exist)

```hcl
aws_region = "{REGION}"

deploy_ui             = true
deploy_gateway        = true
deploy_mcp_server     = true
deploy_research_agent = true
deploy_coding_agent   = true

tags = {
  Project     = "iker-agents"
  Environment = "dev"
  ManagedBy   = "terraform"
  Owner       = "{USERNAME}"
}
```

## Step 3: Guide AWS Setup

After making code changes, provide these commands for the user to run:

### 3.1 Create OIDC Provider
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --region {REGION}
```

### 3.2 Create IAM Role Trust Policy

Tell user to create a file `github-oidc-trust.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::{ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:{USERNAME}/iker-agents:*"
        }
      }
    }
  ]
}
```

### 3.3 Create IAM Role
```bash
aws iam create-role \
  --role-name GitHubActions-iker-agents \
  --assume-role-policy-document file://github-oidc-trust.json

aws iam attach-role-policy \
  --role-name GitHubActions-iker-agents \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### 3.4 Create S3 Bucket for Terraform State
```bash
aws s3 mb s3://{BUCKET_NAME} --region {REGION}

aws s3api put-bucket-versioning \
  --bucket {BUCKET_NAME} \
  --versioning-configuration Status=Enabled
```

### 3.5 Create DynamoDB Table for Locking
```bash
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region {REGION}
```

### 3.6 Enable Bedrock Model Access

Tell user:
```
Go to AWS Console -> Amazon Bedrock -> Model access
Request access to:
- anthropic.claude-3-5-sonnet-20241022-v2:0
- anthropic.claude-3-5-haiku-20241022-v1:0

This is usually approved instantly for Claude models.
```

## Step 4: Create First PR

After AWS resources are created:

### 4.1 Commit Changes
```bash
git add -A
git commit -m "Configure deployment for {USERNAME}'s AWS account

- Update terraform backend to use {BUCKET_NAME}
- Configure GitHub Actions OIDC for account {ACCOUNT_ID}
- Set deployment region to {REGION}

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 4.2 Push and Create PR
```bash
git push -u origin {BRANCH_NAME}

gh pr create --title "Initial deployment configuration" --body "## Summary
- Configured Terraform backend (S3 + DynamoDB)
- Set up GitHub Actions OIDC authentication
- Configured ECR repositories for {REGION}

## Checklist
- [ ] OIDC provider created
- [ ] IAM role created with trust policy
- [ ] S3 bucket created with versioning
- [ ] DynamoDB table created
- [ ] Bedrock model access requested

## Next Steps
Once this PR is merged, GitHub Actions will:
1. Build all Docker images
2. Create ECR repositories
3. Deploy infrastructure via Terraform
4. Deploy the UI to CloudFront
"
```

## Step 5: Post-Merge Instructions

After the PR is merged and CI completes:

```
Congratulations! Your deployment is running.

Next steps:
1. Check GitHub Actions to see the deployment progress
2. Once complete, get your UI URL: cd terraform && terraform output ui_url
3. Create a Cognito user to log in (see README.md Step 10)
4. Visit your UI and start chatting with the agents!

To create a test user:
aws cognito-idp admin-create-user \
  --user-pool-id $(cd terraform && terraform output -raw cognito_user_pool_id) \
  --username your@email.com \
  --user-attributes Name=email,Value=your@email.com \
  --temporary-password TempPass123!
```

## Important Notes

- Always wait for user confirmation before making file changes
- Show the user what changes will be made before applying them
- If any AWS command fails, help troubleshoot (permissions, existing resources, etc.)
- The user should have AWS CLI configured with admin permissions locally
- After PR merge, first deployment takes ~10 minutes
