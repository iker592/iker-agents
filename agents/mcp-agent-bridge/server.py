"""MCP Server Bridge - Exposes agents as MCP tools for coding assistants.

This allows Claude Code, Cursor, Windsurf, etc. to communicate with your agents
via the MCP protocol they natively support.

Usage:
    # Local development
    python server.py

    # Or via uvx/npx for coding assistants
    uvx mcp-agent-bridge
"""

import json
import os
from typing import Optional

import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP(
    name="agent-bridge",
    description="Bridge to communicate with AI agents via MCP",
)

# Agent endpoints (configurable via env vars)
AGENTS = {
    "dsp": {
        "name": "DSP Business Agent",
        "description": "Business analyst with access to customer, order, and analytics data",
        "url": os.environ.get("DSP_AGENT_URL", "http://localhost:8080"),
    },
    "research": {
        "name": "Research Agent",
        "description": "Research assistant with web search and document analysis capabilities",
        "url": os.environ.get("RESEARCH_AGENT_URL", "http://localhost:8081"),
    },
    "coding": {
        "name": "Coding Agent",
        "description": "Software engineering assistant with code analysis and generation skills",
        "url": os.environ.get("CODING_AGENT_URL", "http://localhost:8082"),
    },
}

# AG-UI endpoint for streaming (if available)
AGUI_ENDPOINT = os.environ.get("AGUI_ENDPOINT", "/agui")


@mcp.tool()
async def list_agents() -> str:
    """List all available agents that can be messaged.

    Returns:
        JSON list of agents with their names and descriptions
    """
    agents_info = [
        {"id": agent_id, "name": info["name"], "description": info["description"]}
        for agent_id, info in AGENTS.items()
    ]
    return json.dumps({"agents": agents_info}, indent=2)


@mcp.tool()
async def message_agent(
    agent_id: str,
    message: str,
    session_id: Optional[str] = None,
) -> str:
    """Send a message to an agent and get its response.

    Use this to communicate with specialized AI agents. Each agent has different
    capabilities - use list_agents() first to see what's available.

    Args:
        agent_id: ID of the agent to message (e.g., "dsp", "research", "coding")
        message: The message/question to send to the agent
        session_id: Optional session ID for conversation continuity

    Returns:
        The agent's response
    """
    if agent_id not in AGENTS:
        return json.dumps({
            "error": f"Unknown agent: {agent_id}",
            "available_agents": list(AGENTS.keys())
        })

    agent = AGENTS[agent_id]

    # Prepare the request payload
    payload = {
        "input": message,
        "session_id": session_id or "mcp-bridge-session",
        "user_id": "mcp-client",
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Try AG-UI endpoint first for better responses
            agui_url = f"{agent['url']}{AGUI_ENDPOINT}"

            try:
                response = await client.post(
                    agui_url,
                    json=payload,
                    headers={"Accept": "text/event-stream"},
                )

                if response.status_code == 200:
                    # Parse SSE events and extract final message
                    full_response = ""
                    for line in response.text.split("\n"):
                        if line.startswith("data: "):
                            try:
                                event_data = json.loads(line[6:])
                                if event_data.get("type") == "TEXT_DELTA":
                                    full_response += event_data.get("value", "")
                            except json.JSONDecodeError:
                                continue

                    if full_response:
                        return json.dumps({
                            "agent": agent["name"],
                            "response": full_response,
                        }, indent=2)
            except httpx.RequestError:
                pass  # Fall back to standard invoke

            # Fall back to standard invoke endpoint
            response = await client.post(
                f"{agent['url']}/invoke",
                json=payload,
            )

            if response.status_code == 200:
                result = response.json()
                return json.dumps({
                    "agent": agent["name"],
                    "response": result.get("output", result),
                }, indent=2)
            else:
                return json.dumps({
                    "error": f"Agent returned status {response.status_code}",
                    "details": response.text[:500],
                })

    except httpx.RequestError as e:
        return json.dumps({
            "error": f"Failed to connect to agent: {str(e)}",
            "agent_url": agent["url"],
            "hint": "Make sure the agent is running locally or the URL is correct",
        })


@mcp.tool()
async def ask_dsp_agent(question: str, session_id: Optional[str] = None) -> str:
    """Ask the DSP Business Agent a question about customers, orders, or analytics.

    This is a convenience wrapper for the DSP agent. Use for questions like:
    - "How many customers do we have?"
    - "What are the latest orders?"
    - "Show me business analytics"

    Args:
        question: Your business question
        session_id: Optional session ID for conversation continuity

    Returns:
        The agent's analysis and response
    """
    return await message_agent("dsp", question, session_id)


@mcp.tool()
async def ask_research_agent(question: str, session_id: Optional[str] = None) -> str:
    """Ask the Research Agent to investigate a topic or search for information.

    Use for questions like:
    - "Research the latest trends in AI agents"
    - "Find information about competitor X"
    - "Summarize this document"

    Args:
        question: Your research question or task
        session_id: Optional session ID for conversation continuity

    Returns:
        Research findings and analysis
    """
    return await message_agent("research", question, session_id)


@mcp.tool()
async def ask_coding_agent(
    task: str,
    context: Optional[str] = None,
    session_id: Optional[str] = None,
) -> str:
    """Ask the Coding Agent for help with software engineering tasks.

    Use for tasks like:
    - "Review this code for bugs"
    - "How should I implement feature X?"
    - "Explain this algorithm"
    - "Write unit tests for this function"

    Args:
        task: The coding task or question
        context: Optional code context or file contents to analyze
        session_id: Optional session ID for conversation continuity

    Returns:
        Code suggestions, analysis, or implementation guidance
    """
    full_message = task
    if context:
        full_message = f"{task}\n\nContext:\n```\n{context}\n```"

    return await message_agent("coding", full_message, session_id)


if __name__ == "__main__":
    import uvicorn

    print("Starting MCP Agent Bridge server...")
    print(f"Configured agents: {list(AGENTS.keys())}")

    # Run as HTTP server for testing
    uvicorn.run(mcp.sse_app(), host="0.0.0.0", port=8090)
