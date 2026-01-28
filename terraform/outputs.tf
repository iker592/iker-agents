# Outputs in a format compatible with existing scripts
# Can be written to terraform-outputs.json for script consumption

output "DSPAgentStackTF" {
  description = "DSP Agent (Terraform) stack outputs - compatible with CDK output format"
  value = {
    RuntimeArn       = module.dsp_agent.runtime_arn
    RuntimeId        = module.dsp_agent.runtime_id
    MemoryId         = module.dsp_agent.memory_id
    DevEndpointArn   = module.dsp_agent.endpoint_arns["dev"]
    CanaryEndpointArn = module.dsp_agent.endpoint_arns["canary"]
    ProdEndpointArn  = module.dsp_agent.endpoint_arns["prod"]
  }
}

# Individual outputs for easy access
output "dsp_agent_runtime_arn" {
  description = "The DSP agent runtime ARN"
  value       = module.dsp_agent.runtime_arn
}

output "dsp_agent_runtime_id" {
  description = "The DSP agent runtime ID"
  value       = module.dsp_agent.runtime_id
}

output "dsp_agent_memory_id" {
  description = "The DSP agent memory ID"
  value       = module.dsp_agent.memory_id
}

output "dsp_agent_endpoint_arns" {
  description = "Map of DSP agent endpoint names to ARNs"
  value       = module.dsp_agent.endpoint_arns
}
