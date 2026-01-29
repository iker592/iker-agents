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

variable "image_tag" {
  description = "Docker image tag to deploy (set by CI/CD after building)"
  type        = string
  default     = "latest"
}

variable "create_xray_policies" {
  description = "Whether to create X-Ray resource policies (set to false if CDK already created them)"
  type        = bool
  default     = false
}

variable "deploy_ui" {
  description = "Whether to deploy the UI (S3 + Lambda + API Gateway + CloudFront)"
  type        = bool
  default     = true
}
