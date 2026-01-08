from .base_stack import AgentStack


class ResearchAgentStack(AgentStack):
    """CDK Stack for the Research Agent."""

    def __init__(self, scope, construct_id, **kwargs):
        # Extract suffix from construct_id (e.g., "ResearchAgentStack-PR5" -> "-PR5")
        suffix = construct_id.replace("ResearchAgentStack", "")
        agent_name = f"ResearchAgent{suffix}" if suffix else "ResearchAgent"

        super().__init__(
            scope,
            construct_id,
            agent_name=agent_name,
            agent_path="./agents/research",
            **kwargs,
        )
