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

# JWT Authentication (optional)
variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT authentication (enables direct browser-to-AgentCore streaming)"
  type        = string
  default     = ""
}

variable "cognito_client_ids" {
  description = "Allowed Cognito client IDs for JWT authentication"
  type        = list(string)
  default     = []
}

# MCP Server integration
variable "mcp_server_arn" {
  description = "ARN of MCP Server AgentCore Runtime (for agent-to-MCP invocation)"
  type        = string
  default     = ""
}

variable "enable_mcp_server" {
  description = "Whether to enable MCP server integration (used for IAM policy creation)"
  type        = bool
  default     = false
}

# Code Interpreter integration
variable "code_interpreter_arn" {
  description = "ARN of Code Interpreter for secure code execution"
  type        = string
  default     = ""
}

variable "enable_code_interpreter" {
  description = "Whether to enable Code Interpreter integration"
  type        = bool
  default     = false
}
