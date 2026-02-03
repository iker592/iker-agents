import json
import os
from typing import Any

import boto3
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from strands import tool
from strands.models.bedrock import BedrockModel
from strands_tools import calculator
from strands_tools.code_interpreter import AgentCoreCodeInterpreter
from yahoo_dsp_agent_sdk.agent import Agent

from .skills_loader import (
    get_skills_system_prompt_addition,
    list_skills,
    load_skill,
    read_skill_file,
)

# Global code interpreter instance (initialized per agent)
_code_interpreter: AgentCoreCodeInterpreter | None = None


def _get_code_interpreter(region: str) -> AgentCoreCodeInterpreter:
    """Get or create the code interpreter instance."""
    global _code_interpreter
    if _code_interpreter is None:
        _code_interpreter = AgentCoreCodeInterpreter(region=region)
    return _code_interpreter


@tool
def code_interpreter(code_interpreter_input: dict | str) -> dict[str, Any]:
    """Execute code in an isolated sandbox environment.

    Supports Python, JavaScript, and TypeScript. Use this to run code,
    perform calculations, data analysis, or verify solutions.

    Args:
        code_interpreter_input: Input containing the action to perform.
            For code execution, use:
            {
                "action": {
                    "type": "executeCode",
                    "code": "print('Hello!')",
                    "language": "python"
                }
            }

    Returns:
        Execution results with status and output.
    """
    # Handle case where LLM returns input as JSON string instead of dict
    if isinstance(code_interpreter_input, str):
        try:
            code_interpreter_input = json.loads(code_interpreter_input)
        except json.JSONDecodeError as e:
            return {
                "status": "error",
                "content": [{"text": f"Invalid JSON input: {e}"}],
            }

    # Get the underlying code interpreter
    region = os.environ.get("AWS_REGION", "us-east-1")
    ci = _get_code_interpreter(region)

    # Call the underlying tool
    try:
        return ci.code_interpreter(code_interpreter_input=code_interpreter_input)
    except Exception as e:
        return {
            "status": "error",
            "content": [{"text": f"Code execution failed: {e}"}],
        }


def create_coding_agent(
    memory_id: str | None = None,
    session_id: str | None = None,
    actor_id: str | None = None,
    region_name: str = "us-east-1",
) -> Agent:
    """Create a Coding Agent specialized in writing and executing code."""
    global _code_interpreter
    _code_interpreter = None  # Reset for new agent

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

    # Initialize the code interpreter for this region
    _get_code_interpreter(region_name)

    # Build system prompt with skills
    base_prompt = (
        "You are a Coding Agent specialized in writing and executing code. "
        "You can run Python, JavaScript, and TypeScript using code_interpreter. "
        "Pass input as a dict with an 'action' field. "
        "Write clean, well-documented code and explain your approach."
    )
    skills_addition = get_skills_system_prompt_addition()
    system_prompt = base_prompt + skills_addition

    agent = Agent(
        model=model,
        system_prompt=system_prompt,
        tools=[calculator, code_interpreter, list_skills, load_skill, read_skill_file],
        session_manager=session_manager,
        agent_id="coding-agent",
        description="Coding Agent for Python, JavaScript, and TypeScript programming.",
    )

    return agent
