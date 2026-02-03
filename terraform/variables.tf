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

variable "deploy_gateway" {
  description = "Whether to deploy the MCP Gateway with Lambda tools (legacy, disabled - agent uses MCP Server Runtime directly)"
  type        = bool
  default     = false
}

variable "deploy_mcp_server" {
  description = "Whether to deploy the MCP server as AgentCore Runtime"
  type        = bool
  default     = true
}

variable "mcp_server_image_tag" {
  description = "Docker image tag for MCP server"
  type        = string
  default     = "latest"
}

variable "research_agent_image_tag" {
  description = "Docker image tag for Research agent"
  type        = string
  default     = "latest"
}

variable "coding_agent_image_tag" {
  description = "Docker image tag for Coding agent"
  type        = string
  default     = "latest"
}

variable "deploy_research_agent" {
  description = "Whether to deploy the Research agent"
  type        = bool
  default     = true
}

variable "deploy_coding_agent" {
  description = "Whether to deploy the Coding agent"
  type        = bool
  default     = true
}
