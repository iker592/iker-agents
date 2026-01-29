# MCP Server Module Variables

variable "name" {
  description = "Name prefix for MCP server resources"
  type        = string
  default     = "agentcore-mcp"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
