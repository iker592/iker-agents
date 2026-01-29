# UI Module Variables

variable "name" {
  description = "Name prefix for UI resources"
  type        = string
  default     = "agent-ui"
}

variable "runtime_arns" {
  description = "Map of agent names to runtime ARNs"
  type        = map(string)
  default     = {}
}

variable "ui_dist_path" {
  description = "Path to the UI dist directory"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "enable_auth" {
  description = "Enable Cognito authentication for the API"
  type        = bool
  default     = true
}

variable "cognito_user_pool_id" {
  description = "External Cognito User Pool ID (if provided, skips internal Cognito creation)"
  type        = string
  default     = ""
}

variable "cognito_user_pool_client_id" {
  description = "External Cognito User Pool Client ID (if provided, skips internal Cognito creation)"
  type        = string
  default     = ""
}

variable "callback_urls" {
  description = "OAuth callback URLs for Cognito"
  type        = list(string)
  default     = []
}

variable "logout_urls" {
  description = "OAuth logout URLs for Cognito"
  type        = list(string)
  default     = []
}
