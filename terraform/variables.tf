variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "tags" {
  description = "Default tags to apply to all resources"
  type        = map(string)
  default = {
    ManagedBy = "terraform"
    Project   = "iker-agents"
  }
}

variable "ecr_image_uri" {
  description = "ECR image URI for the agent runtime (reuse from CDK)"
  type        = string
  # Default to the CDK-built image - must be arm64 architecture
  # Get the current image with: aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id <id> --query 'agentRuntimeArtifact.containerConfiguration.containerUri'
  default = "239388734812.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-239388734812-us-east-1:f979f3a11da90930bc55b279b9c2b9b2990a33de2bea7020c44f21fbc29c47ba"
}

variable "create_xray_policies" {
  description = "Whether to create X-Ray resource policies (set to false if CDK already created them)"
  type        = bool
  default     = false
}
