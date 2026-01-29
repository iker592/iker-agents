"""MCP Tools - Wrappers that call the MCP server Lambda for business data."""

import json
import os
from typing import Any

import boto3
from strands import tool

# MCP Lambda function name - set by environment or default
MCP_LAMBDA_NAME = os.environ.get("MCP_LAMBDA_NAME", "agentcore-mcp-mcp-server")


def _invoke_mcp_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Invoke an MCP tool via Lambda and return the result."""
    lambda_client = boto3.client("lambda", region_name="us-east-1")

    payload = {
        "body": json.dumps(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments},
            }
        )
    }

    response = lambda_client.invoke(
        FunctionName=MCP_LAMBDA_NAME,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload),
    )

    response_payload = json.loads(response["Payload"].read())
    body = json.loads(response_payload.get("body", "{}"))

    if "error" in body:
        raise Exception(f"MCP error: {body['error']}")

    result = body.get("result", {})
    content = result.get("content", [])

    if content and content[0].get("type") == "text":
        return json.loads(content[0]["text"])

    return result


@tool
def get_customer(customer_id: str) -> dict:
    """Get customer details by ID.

    Use this tool to retrieve information about a specific customer including
    their name, email, tier (enterprise/growth/starter), and account balance.

    Args:
        customer_id: Customer ID (e.g., "cust-001", "cust-002", "cust-003")

    Returns:
        Customer details including id, name, email, tier, and balance
    """
    return _invoke_mcp_tool("get_customer", {"customer_id": customer_id})


@tool
def list_customers(tier: str = None) -> dict:
    """List all customers, optionally filtered by tier.

    Use this tool to get a list of all customers or filter by their subscription tier.

    Args:
        tier: Optional filter by tier: "enterprise", "growth", or "starter"

    Returns:
        List of customers with their details and total count
    """
    args = {}
    if tier:
        args["tier"] = tier
    return _invoke_mcp_tool("list_customers", args)


@tool
def search_customers(query: str) -> dict:
    """Search customers by name or email.

    Use this tool to find customers matching a search query.

    Args:
        query: Search query to match against customer names or emails

    Returns:
        List of matching customers and total count
    """
    return _invoke_mcp_tool("search_customers", {"query": query})


@tool
def get_order(order_id: str) -> dict:
    """Get order details by ID.

    Use this tool to retrieve information about a specific order including
    items, status, customer, and total amount.

    Args:
        order_id: Order ID (e.g., "ord-001", "ord-002", "ord-003")

    Returns:
        Order details including id, customer_id, items, status, created_at, and total
    """
    return _invoke_mcp_tool("get_order", {"order_id": order_id})


@tool
def list_orders(customer_id: str = None, status: str = None) -> dict:
    """List orders, optionally filtered by customer or status.

    Use this tool to get a list of orders with optional filtering.

    Args:
        customer_id: Optional filter by customer ID
        status: Optional filter by status: "pending", "processing", or "completed"

    Returns:
        List of orders with their details and total count
    """
    args = {}
    if customer_id:
        args["customer_id"] = customer_id
    if status:
        args["status"] = status
    return _invoke_mcp_tool("list_orders", args)


@tool
def create_order(customer_id: str, items: str) -> dict:
    """Create a new order for a customer.

    Use this tool to create a new order with specified items.

    Args:
        customer_id: Customer ID to create the order for
        items: JSON array of items, each with name, quantity, and price
               Example: '[{"name": "Product", "quantity": 1, "price": 100.00}]'

    Returns:
        Created order details including id, items, total, and confirmation message
    """
    return _invoke_mcp_tool(
        "create_order", {"customer_id": customer_id, "items": items}
    )


@tool
def get_analytics() -> dict:
    """Get current business analytics and KPIs.

    Use this tool to retrieve key business metrics including daily active users,
    monthly revenue, churn rate, NPS score, and open support tickets.

    Returns:
        Business metrics with generated timestamp
    """
    return _invoke_mcp_tool("get_analytics", {})


@tool
def get_revenue_forecast(months: int = 3) -> dict:
    """Get revenue forecast for the next N months.

    Use this tool to project future revenue based on current metrics and growth rate.

    Args:
        months: Number of months to forecast (default: 3)

    Returns:
        Base revenue, growth rate, and monthly projections
    """
    return _invoke_mcp_tool("get_revenue_forecast", {"months": months})


# Export all tools for easy import
MCP_TOOLS = [
    get_customer,
    list_customers,
    search_customers,
    get_order,
    list_orders,
    create_order,
    get_analytics,
    get_revenue_forecast,
]
