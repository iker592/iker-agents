from aws_cdk import App

from .coding_stack import CodingAgentStack
from .github_oidc_stack import GitHubOIDCStack
from .research_stack import ResearchAgentStack
from .stack import DSPAgentStack

app = App()

# GitHub OIDC for CI/CD authentication
GitHubOIDCStack(app, "GitHubOIDCStack")

# Main DSP agent stack
DSPAgentStack(app, "DSPAgentStack")

# Multi-agent stacks with HTTP + A2A protocols
ResearchAgentStack(app, "ResearchAgentStack")
CodingAgentStack(app, "CodingAgentStack")

app.synth()
