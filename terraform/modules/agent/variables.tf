variable "agent_name" {
  description = "Name of the agent (used for resource naming)"
  type        = string
}

variable "memory_name" {
  description = "Name of the memory resource"
  type        = string
}

variable "runtime_name" {
  description = "Name of the agent runtime"
  type        = string
}

variable "ecr_image_uri" {
  description = "ECR image URI for the agent container"
  type        = string
}

variable "model" {
  description = "Bedrock model ID to use"
  type        = string
  default     = "bedrock:global.anthropic.claude-sonnet-4-5-20250929-v1:0"
}

variable "extra_environment_variables" {
  description = "Additional environment variables for the runtime"
  type        = map(string)
  default     = {}
}

variable "memory_event_expiry_days" {
  description = "Number of days to retain memory events"
  type        = number
  default     = 90
}

variable "endpoints" {
  description = "List of endpoints to create (e.g., dev, canary, prod)"
  type        = list(string)
  default     = ["dev", "canary", "prod"]
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
