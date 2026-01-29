"""DSP Agent with MCP tool integration."""

import os
import sys
from pathlib import Path

import boto3
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from strands.models.bedrock import BedrockModel
from strands_tools import calculator

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from yahoo_dsp_agent_sdk.agent import Agent

from .mcp_tools import MCP_TOOLS


def create_agent(
    memory_id: str | None = None,
    session_id: str | None = None,
    actor_id: str | None = None,
    region_name: str = "us-east-1",
    agent_id: str | None = None,
) -> Agent:
    """Create a configured Strands agent with MCP tools and AgentCore Memory.

    Args:
        memory_id: AgentCore Memory ID (optional, uses MEMORY_ID env var)
        session_id: Session ID for memory (optional)
        actor_id: Actor/user ID for memory (optional)
        region_name: AWS region for memory
        agent_id: Consistent agent ID for memory persistence (optional)

    Returns:
        Configured Agent instance
    """
    memory_id = memory_id or os.environ.get("MEMORY_ID")

    session_manager = None
    if memory_id:
        config = AgentCoreMemoryConfig(
            memory_id=memory_id,
            session_id=session_id or "default-session",
            actor_id=actor_id or "default-actor",
        )
        session_manager = AgentCoreMemorySessionManager(
            agentcore_memory_config=config,
            region_name=region_name,
        )

    model = BedrockModel(
        model_id="us.anthropic.claude-3-5-haiku-20241022-v1:0",
        boto_session=boto3.Session(region_name="us-west-2"),
        temperature=0.0,
    )

    # Combine calculator with MCP business tools
    all_tools = [calculator] + MCP_TOOLS

    agent = Agent(
        model=model,
        system_prompt=(
            "You are a business analyst with access to customer, order, "
            "and analytics data. You help users analyze business data, "
            "look up customer information, check orders, review analytics "
            "metrics, and perform calculations. Always use the available "
            "tools to fetch real data before answering questions. "
            "Be precise and concise in your responses."
        ),
        tools=all_tools,
        session_manager=session_manager,
        agent_id=agent_id or "analyst-agent",
    )

    return agent


if __name__ == "__main__":
    print("=== Testing Business Analyst Agent ===\n")

    agent = create_agent()

    print("Example 1: List customers")
    structured_output, result = agent.invoke("How many customers do we have?")
    print(f"Result: {result.message['content'][0]['text']}\n")

    print("Example 2: Get analytics")
    structured_output, result = agent.invoke("What are our current business metrics?")
    print(f"Result: {result.message['content'][0]['text']}\n")
