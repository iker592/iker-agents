from aws_cdk import App

from .coding_stack import CodingAgentStack
from .github_oidc_stack import GitHubOIDCStack
from .research_stack import ResearchAgentStack
from .stack import DSPAgentStack
from .ui_stack import UIStack

app = App()

# Check if this is a preview deployment
is_preview = app.node.try_get_context("preview") == "true"
pr_number = app.node.try_get_context("pr") if is_preview else None

# Suffix for preview stacks
suffix = f"-PR{pr_number}" if is_preview and pr_number else ""

# GitHub OIDC for CI/CD authentication (only in production)
if not is_preview:
    GitHubOIDCStack(app, "GitHubOIDCStack")

# Main DSP agent stack
dsp_stack = DSPAgentStack(app, f"DSPAgentStack{suffix}")

# Multi-agent stacks with HTTP + A2A protocols
research_stack = ResearchAgentStack(app, f"ResearchAgentStack{suffix}")
coding_stack = CodingAgentStack(app, f"CodingAgentStack{suffix}")

# Collect runtime ARNs for UI
runtime_arns = {
    "dsp": dsp_stack.runtime.agent_runtime_arn,
    "research": research_stack.runtime.agent_runtime_arn,
    "coding": coding_stack.runtime.agent_runtime_arn,
}

# UI Stack with access to all agents
UIStack(app, f"UIStack{suffix}", runtime_arns=runtime_arns)

app.synth()
