"""MCP Client - Connects to AgentCore MCP Server Runtime using boto3."""

import json
import os
from typing import Any

import boto3

# MCP Server ARN - set by Terraform via environment variable
MCP_SERVER_ARN = os.environ.get("MCP_SERVER_ARN", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")


def _get_agentcore_client():
    """Get the bedrock-agentcore boto3 client."""
    return boto3.client("bedrock-agentcore", region_name=AWS_REGION)


def call_mcp_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Call an MCP tool on the AgentCore MCP Server.

    Args:
        tool_name: Name of the MCP tool to invoke
        arguments: Arguments to pass to the tool

    Returns:
        Tool result as a dictionary

    Raises:
        ValueError: If MCP_SERVER_ARN is not configured
        Exception: If MCP server returns an error
    """
    if not MCP_SERVER_ARN:
        raise ValueError("MCP_SERVER_ARN environment variable not set")

    # MCP JSON-RPC request
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments},
    }

    client = _get_agentcore_client()

    # Invoke the MCP server runtime using boto3
    response = client.invoke_agent_runtime(
        agentRuntimeArn=MCP_SERVER_ARN,
        qualifier="default",
        contentType="application/json",
        accept="application/json",
        payload=json.dumps(payload).encode("utf-8"),
    )

    # Read the streaming response
    result_bytes = b""
    event_stream = response.get("response")
    if event_stream:
        for event in event_stream:
            if "chunk" in event:
                result_bytes += event["chunk"].get("bytes", b"")

    if not result_bytes:
        raise Exception("Empty response from MCP server")

    result = json.loads(result_bytes.decode("utf-8"))

    # Handle MCP JSON-RPC response
    if "error" in result:
        error = result["error"]
        code = error.get("code", "unknown")
        message = error.get("message", str(error))
        raise Exception(f"MCP error {code}: {message}")

    mcp_result = result.get("result", {})
    content = mcp_result.get("content", [])

    # Extract text content from MCP response
    if content and content[0].get("type") == "text":
        text = content[0]["text"]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"text": text}

    return mcp_result


def is_mcp_configured() -> bool:
    """Check if MCP server is configured."""
    return bool(MCP_SERVER_ARN)
