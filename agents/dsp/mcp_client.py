"""MCP Client - Connects to AgentCore MCP Server Runtime using MCP protocol."""

import json
import os
from typing import Any

import boto3
import httpx
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

# MCP Server ARN - set by Terraform via environment variable
MCP_SERVER_ARN = os.environ.get("MCP_SERVER_ARN", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")


def _get_mcp_url() -> str:
    """Build the MCP server URL from the runtime ARN."""
    if not MCP_SERVER_ARN:
        return ""

    # URL-encode the ARN
    encoded_arn = MCP_SERVER_ARN.replace(":", "%3A").replace("/", "%2F")
    return f"https://bedrock-agentcore.{AWS_REGION}.amazonaws.com/runtimes/{encoded_arn}/invocations?qualifier=default"


def _sign_request(method: str, url: str, body: str) -> dict[str, str]:
    """Sign the request using SigV4 for AgentCore invocation."""
    session = boto3.Session()
    credentials = session.get_credentials()

    request = AWSRequest(method=method, url=url, data=body)
    request.headers["Content-Type"] = "application/json"

    SigV4Auth(credentials, "bedrock-agentcore", AWS_REGION).add_auth(request)

    return dict(request.headers)


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
    url = _get_mcp_url()
    if not url:
        raise ValueError("MCP_SERVER_ARN environment variable not set")

    # MCP JSON-RPC request
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments},
    }
    body = json.dumps(payload)

    # Sign the request with SigV4
    headers = _sign_request("POST", url, body)

    # Make the HTTP request
    with httpx.Client(timeout=120.0) as client:
        response = client.post(url, content=body, headers=headers)
        response.raise_for_status()

    result = response.json()

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
