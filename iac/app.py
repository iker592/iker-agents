from aws_cdk import App

from .coding_stack import CodingAgentStack
from .github_oidc_stack import GitHubOIDCStack
from .research_stack import ResearchAgentStack
from .stack import DSPAgentStack
from .ui_stack import UIStack

app = App()

# GitHub OIDC for CI/CD authentication
GitHubOIDCStack(app, "GitHubOIDCStack")

# Main DSP agent stack
dsp_stack = DSPAgentStack(app, "DSPAgentStack")

# Multi-agent stacks with HTTP + A2A protocols
research_stack = ResearchAgentStack(app, "ResearchAgentStack")
coding_stack = CodingAgentStack(app, "CodingAgentStack")

# Collect runtime ARNs for UI
runtime_arns = {
    "dsp": dsp_stack.runtime.agent_runtime_arn,
    "research": research_stack.runtime.agent_runtime_arn,
    "coding": coding_stack.runtime.agent_runtime_arn,
}

# UI Stack with access to all agents
UIStack(app, "UIStack", runtime_arns=runtime_arns)

app.synth()
