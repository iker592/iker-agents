variable "name" {
  description = "Name of the Code Interpreter"
  type        = string
}

variable "description" {
  description = "Description of the Code Interpreter"
  type        = string
  default     = "AgentCore Code Interpreter for secure code execution"
}

variable "network_mode" {
  description = "Network mode: SANDBOX (limited network) or PUBLIC (internet access)"
  type        = string
  default     = "PUBLIC"

  validation {
    condition     = contains(["SANDBOX", "PUBLIC"], var.network_mode)
    error_message = "network_mode must be SANDBOX or PUBLIC"
  }
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
