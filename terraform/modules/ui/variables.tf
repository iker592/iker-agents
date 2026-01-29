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
