"""MCP Server with business tools - AgentCore Runtime compatible."""

import json
from datetime import datetime, timedelta

from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server - stateless_http required for AgentCore
mcp = FastMCP(name="agentcore-mcp-business", host="0.0.0.0", stateless_http=True)

# ============================================================================
# Mock Data Store - Demo business data
# ============================================================================

MOCK_CUSTOMERS = {
    "cust-001": {
        "id": "cust-001",
        "name": "Acme Corporation",
        "email": "contact@acme.com",
        "tier": "enterprise",
        "balance": 15000.00,
    },
    "cust-002": {
        "id": "cust-002",
        "name": "TechStart Inc",
        "email": "hello@techstart.io",
        "tier": "growth",
        "balance": 3500.00,
    },
    "cust-003": {
        "id": "cust-003",
        "name": "DataFlow Labs",
        "email": "info@dataflow.dev",
        "tier": "starter",
        "balance": 750.00,
    },
}

MOCK_ORDERS = {
    "ord-001": {
        "id": "ord-001",
        "customer_id": "cust-001",
        "items": [{"name": "Enterprise License", "quantity": 1, "price": 10000.00}],
        "status": "completed",
        "created_at": "2024-01-10",
    },
    "ord-002": {
        "id": "ord-002",
        "customer_id": "cust-002",
        "items": [{"name": "Growth License", "quantity": 1, "price": 3000.00}],
        "status": "pending",
        "created_at": "2024-01-25",
    },
    "ord-003": {
        "id": "ord-003",
        "customer_id": "cust-001",
        "items": [{"name": "Add-on Module", "quantity": 3, "price": 500.00}],
        "status": "processing",
        "created_at": "2024-01-28",
    },
}

MOCK_ANALYTICS = {
    "daily_active_users": 1250,
    "monthly_revenue": 45000.00,
    "churn_rate": 0.02,
    "nps_score": 72,
    "support_tickets_open": 15,
}


# ============================================================================
# MCP Tools
# ============================================================================


@mcp.tool()
def get_customer(customer_id: str) -> str:
    """Get customer details by ID.

    Args:
        customer_id: Customer ID (e.g., cust-001)

    Returns:
        Customer details including name, email, tier, and balance
    """
    customer = MOCK_CUSTOMERS.get(customer_id)
    if customer:
        return json.dumps(customer, indent=2)
    return json.dumps({"error": f"Customer not found: {customer_id}"})


@mcp.tool()
def list_customers(tier: str = None) -> str:
    """List all customers, optionally filtered by tier.

    Args:
        tier: Optional filter by tier (enterprise, growth, starter)

    Returns:
        List of customers with total count
    """
    customers = list(MOCK_CUSTOMERS.values())
    if tier:
        customers = [c for c in customers if c["tier"] == tier]
    return json.dumps({"customers": customers, "total": len(customers)}, indent=2)


@mcp.tool()
def search_customers(query: str) -> str:
    """Search customers by name or email.

    Args:
        query: Search query to match against names or emails

    Returns:
        Matching customers with total count
    """
    query_lower = query.lower()
    matches = [
        c
        for c in MOCK_CUSTOMERS.values()
        if query_lower in c["name"].lower() or query_lower in c["email"].lower()
    ]
    return json.dumps({"results": matches, "total": len(matches)}, indent=2)


@mcp.tool()
def get_order(order_id: str) -> str:
    """Get order details by ID.

    Args:
        order_id: Order ID (e.g., ord-001)

    Returns:
        Order details including items, status, and total
    """
    order = MOCK_ORDERS.get(order_id)
    if order:
        total = sum(i["quantity"] * i["price"] for i in order["items"])
        return json.dumps({**order, "total": total}, indent=2)
    return json.dumps({"error": f"Order not found: {order_id}"})


@mcp.tool()
def list_orders(customer_id: str = None, status: str = None) -> str:
    """List orders, optionally filtered by customer or status.

    Args:
        customer_id: Optional filter by customer ID
        status: Optional filter by status (pending, processing, completed)

    Returns:
        List of orders with totals
    """
    orders = list(MOCK_ORDERS.values())
    if customer_id:
        orders = [o for o in orders if o["customer_id"] == customer_id]
    if status:
        orders = [o for o in orders if o["status"] == status]

    for order in orders:
        order["total"] = sum(i["quantity"] * i["price"] for i in order["items"])

    return json.dumps({"orders": orders, "total": len(orders)}, indent=2)


@mcp.tool()
def create_order(customer_id: str, items: str) -> str:
    """Create a new order for a customer.

    Args:
        customer_id: Customer ID to create order for
        items: JSON array of items with name, quantity, price

    Returns:
        Created order details
    """
    if customer_id not in MOCK_CUSTOMERS:
        return json.dumps({"error": f"Customer not found: {customer_id}"})

    try:
        items_list = json.loads(items)
        order_id = f"ord-{len(MOCK_ORDERS) + 1:03d}"
        new_order = {
            "id": order_id,
            "customer_id": customer_id,
            "items": items_list,
            "status": "pending",
            "created_at": datetime.now().strftime("%Y-%m-%d"),
        }
        MOCK_ORDERS[order_id] = new_order
        total = sum(i["quantity"] * i["price"] for i in items_list)
        return json.dumps(
            {**new_order, "total": total, "message": "Order created"}, indent=2
        )
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid items JSON"})


@mcp.tool()
def get_analytics() -> str:
    """Get current business analytics and KPIs.

    Returns:
        Business metrics including DAU, revenue, churn, NPS, tickets
    """
    return json.dumps(
        {"metrics": MOCK_ANALYTICS, "generated_at": datetime.now().isoformat()},
        indent=2,
    )


@mcp.tool()
def get_revenue_forecast(months: int = 3) -> str:
    """Get revenue forecast for the next N months.

    Args:
        months: Number of months to forecast (default: 3)

    Returns:
        Revenue projections with growth rate
    """
    base = MOCK_ANALYTICS["monthly_revenue"]
    growth = 0.05
    forecast = []
    now = datetime.now()

    for i in range(months):
        future = now + timedelta(days=30 * (i + 1))
        projected = base * ((1 + growth) ** (i + 1))
        forecast.append({
            "month": future.strftime("%Y-%m"),
            "projected_revenue": round(projected, 2),
        })

    return json.dumps(
        {"base_revenue": base, "growth_rate": "5%", "forecast": forecast}, indent=2
    )


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
