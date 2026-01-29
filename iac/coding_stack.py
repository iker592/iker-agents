from .base_stack import AgentStack


class CodingAgentStack(AgentStack):
    """CDK Stack for the Coding Agent."""

    def __init__(self, scope, construct_id, **kwargs):
        # Extract suffix from construct_id (e.g., "CodingAgentStack-PR5" -> "-PR5")
        suffix = construct_id.replace("CodingAgentStack", "")
        agent_name = f"CodingAgent{suffix}" if suffix else "CodingAgent"

        super().__init__(
            scope,
            construct_id,
            agent_name=agent_name,
            agent_path="./agents/coding",
            # python_repl tool needs a writable directory for state persistence
            extra_environment_variables={
                "PYTHON_REPL_PERSISTENCE_DIR": "/tmp",
            },
            **kwargs,
        )
