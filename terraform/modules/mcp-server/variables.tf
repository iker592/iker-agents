# MCP Server Module Variables

variable "name" {
  description = "Name prefix for MCP server resources"
  type        = string
  default     = "mcp-server"
}

variable "runtime_name" {
  description = "Name for the MCP server runtime"
  type        = string
}

variable "endpoint_name" {
  description = "Name for the runtime endpoint"
  type        = string
  default     = "default"
}

variable "ecr_image_uri" {
  description = "ECR image URI for MCP server container"
  type        = string
}

variable "instructions" {
  description = "MCP server instructions/description"
  type        = string
  default     = "Business data MCP server providing customer, order, and analytics tools"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
