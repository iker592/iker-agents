# Gateway Module Variables

variable "name" {
  description = "Name prefix for gateway resources"
  type        = string
  default     = "agentcore-mcp"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT authentication (optional)"
  type        = string
  default     = ""
}

variable "cognito_client_ids" {
  description = "List of allowed Cognito client IDs"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
