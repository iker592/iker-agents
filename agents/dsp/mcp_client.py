"""MCP Client - Connects to MCP server for dynamic tool discovery."""

import os
from datetime import timedelta

from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp import MCPClient

# MCP Server URL - set by environment variable
MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "")
MCP_ACCESS_TOKEN = os.environ.get("MCP_ACCESS_TOKEN", "")


def get_mcp_client() -> MCPClient | None:
    """Create an MCP client for the configured server.

    Returns:
        MCPClient instance if MCP_SERVER_URL is set, None otherwise
    """
    if not MCP_SERVER_URL:
        return None

    headers = {"Content-Type": "application/json"}
    if MCP_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {MCP_ACCESS_TOKEN}"

    return MCPClient(
        lambda: streamablehttp_client(
            MCP_SERVER_URL,
            headers=headers,
            timeout=timedelta(seconds=30),
        )
    )


def get_mcp_tools(client: MCPClient) -> list:
    """Get all tools from MCP client with pagination support.

    Args:
        client: Started MCPClient instance

    Returns:
        List of MCP tools
    """
    more_tools = True
    tools = []
    pagination_token = None

    while more_tools:
        result = client.list_tools_sync(pagination_token=pagination_token)
        # result might be a list or have a pagination_token attribute
        if isinstance(result, list):
            tools.extend(result)
            more_tools = False
        else:
            tools.extend(result)
            if hasattr(result, "pagination_token") and result.pagination_token:
                pagination_token = result.pagination_token
            else:
                more_tools = False

    return tools
