# AgentCore MCP Server Module - Standalone MCP Tools Lambda
# Can be connected to AgentCore Gateway manually or invoked directly

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.id
}

# IAM Role for MCP Lambda
resource "aws_iam_role" "mcp_lambda" {
  name = "${var.name}-mcp-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "mcp_lambda_logs" {
  name = "lambda-logs"
  role = aws_iam_role.mcp_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# MCP Server Lambda Function with demo tools
resource "aws_lambda_function" "mcp_server" {
  function_name = "${var.name}-mcp-server"
  role          = aws_iam_role.mcp_lambda.arn
  handler       = "index.handler"
  runtime       = "python3.13"
  timeout       = 30

  filename         = data.archive_file.mcp_lambda.output_path
  source_code_hash = data.archive_file.mcp_lambda.output_base64sha256

  tags = var.tags
}

data "archive_file" "mcp_lambda" {
  type        = "zip"
  output_path = "${path.module}/mcp_lambda.zip"

  source {
    content  = <<-EOF
import json
from datetime import datetime, timedelta

# ============================================================================
# Mock Data Store - Demo business data
# ============================================================================

MOCK_CUSTOMERS = {
    "cust-001": {"id": "cust-001", "name": "Acme Corporation", "email": "contact@acme.com", "tier": "enterprise", "balance": 15000.00},
    "cust-002": {"id": "cust-002", "name": "TechStart Inc", "email": "hello@techstart.io", "tier": "growth", "balance": 3500.00},
    "cust-003": {"id": "cust-003", "name": "DataFlow Labs", "email": "info@dataflow.dev", "tier": "starter", "balance": 750.00}
}

MOCK_ORDERS = {
    "ord-001": {"id": "ord-001", "customer_id": "cust-001", "items": [{"name": "Enterprise License", "quantity": 1, "price": 10000.00}], "status": "completed", "created_at": "2024-01-10"},
    "ord-002": {"id": "ord-002", "customer_id": "cust-002", "items": [{"name": "Growth License", "quantity": 1, "price": 3000.00}], "status": "pending", "created_at": "2024-01-25"},
    "ord-003": {"id": "ord-003", "customer_id": "cust-001", "items": [{"name": "Add-on Module", "quantity": 3, "price": 500.00}], "status": "processing", "created_at": "2024-01-28"}
}

MOCK_ANALYTICS = {"daily_active_users": 1250, "monthly_revenue": 45000.00, "churn_rate": 0.02, "nps_score": 72, "support_tickets_open": 15}

# ============================================================================
# MCP Protocol Handlers
# ============================================================================

def get_tools_list():
    """Return list of available tools in MCP format."""
    return {
        "tools": [
            {
                "name": "get_customer",
                "description": "Get customer details by ID",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "customer_id": {"type": "string", "description": "Customer ID (e.g., cust-001)"}
                    },
                    "required": ["customer_id"]
                }
            },
            {
                "name": "list_customers",
                "description": "List all customers, optionally filtered by tier",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "tier": {"type": "string", "description": "Filter by tier: enterprise, growth, starter"}
                    }
                }
            },
            {
                "name": "search_customers",
                "description": "Search customers by name or email",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "get_order",
                "description": "Get order details by ID",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "order_id": {"type": "string", "description": "Order ID (e.g., ord-001)"}
                    },
                    "required": ["order_id"]
                }
            },
            {
                "name": "list_orders",
                "description": "List orders, optionally filtered by customer or status",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "customer_id": {"type": "string", "description": "Filter by customer ID"},
                        "status": {"type": "string", "description": "Filter by status: pending, processing, completed"}
                    }
                }
            },
            {
                "name": "create_order",
                "description": "Create a new order for a customer",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "customer_id": {"type": "string", "description": "Customer ID"},
                        "items": {"type": "string", "description": "JSON array of items"}
                    },
                    "required": ["customer_id", "items"]
                }
            },
            {
                "name": "get_analytics",
                "description": "Get current business analytics and KPIs",
                "inputSchema": {"type": "object", "properties": {}}
            },
            {
                "name": "get_revenue_forecast",
                "description": "Get revenue forecast for the next N months",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "months": {"type": "integer", "description": "Number of months (default: 3)"}
                    }
                }
            },
            {
                "name": "calculate",
                "description": "Evaluate a mathematical expression",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "expression": {"type": "string", "description": "Math expression (e.g., 2 + 2 * 3)"}
                    },
                    "required": ["expression"]
                }
            },
            {
                "name": "get_current_time",
                "description": "Get the current date and time",
                "inputSchema": {"type": "object", "properties": {}}
            }
        ]
    }

def call_tool(name, arguments):
    """Execute a tool and return the result."""
    try:
        if name == "get_customer":
            customer = MOCK_CUSTOMERS.get(arguments.get("customer_id"))
            result = customer if customer else {"error": f"Customer not found: {arguments.get('customer_id')}"}

        elif name == "list_customers":
            customers = list(MOCK_CUSTOMERS.values())
            tier = arguments.get("tier")
            if tier:
                customers = [c for c in customers if c["tier"] == tier]
            result = {"customers": customers, "total": len(customers)}

        elif name == "search_customers":
            query = arguments.get("query", "").lower()
            matches = [c for c in MOCK_CUSTOMERS.values() if query in c["name"].lower() or query in c["email"].lower()]
            result = {"results": matches, "total": len(matches)}

        elif name == "get_order":
            order = MOCK_ORDERS.get(arguments.get("order_id"))
            if order:
                total = sum(i["quantity"] * i["price"] for i in order["items"])
                result = {**order, "total": total}
            else:
                result = {"error": f"Order not found: {arguments.get('order_id')}"}

        elif name == "list_orders":
            orders = list(MOCK_ORDERS.values())
            cid = arguments.get("customer_id")
            status = arguments.get("status")
            if cid:
                orders = [o for o in orders if o["customer_id"] == cid]
            if status:
                orders = [o for o in orders if o["status"] == status]
            for order in orders:
                order["total"] = sum(i["quantity"] * i["price"] for i in order["items"])
            result = {"orders": orders, "total": len(orders)}

        elif name == "create_order":
            cid = arguments.get("customer_id")
            if cid not in MOCK_CUSTOMERS:
                result = {"error": f"Customer not found: {cid}"}
            else:
                try:
                    items = json.loads(arguments.get("items", "[]"))
                    order_id = f"ord-{len(MOCK_ORDERS) + 1:03d}"
                    new_order = {
                        "id": order_id,
                        "customer_id": cid,
                        "items": items,
                        "status": "pending",
                        "created_at": datetime.now().strftime("%Y-%m-%d")
                    }
                    MOCK_ORDERS[order_id] = new_order
                    total = sum(i["quantity"] * i["price"] for i in items)
                    result = {**new_order, "total": total, "message": "Order created"}
                except json.JSONDecodeError:
                    result = {"error": "Invalid items JSON"}

        elif name == "get_analytics":
            result = {"metrics": MOCK_ANALYTICS, "generated_at": datetime.now().isoformat()}

        elif name == "get_revenue_forecast":
            months = arguments.get("months", 3)
            base = MOCK_ANALYTICS["monthly_revenue"]
            growth = 0.05
            forecast = []
            now = datetime.now()
            for i in range(months):
                future = now + timedelta(days=30 * (i + 1))
                projected = base * ((1 + growth) ** (i + 1))
                forecast.append({
                    "month": future.strftime("%Y-%m"),
                    "projected_revenue": round(projected, 2)
                })
            result = {"base_revenue": base, "growth_rate": "5%", "forecast": forecast}

        elif name == "calculate":
            expr = arguments.get("expression", "")
            allowed = set("0123456789+-*/.() ")
            if all(c in allowed for c in expr):
                calc_result = eval(expr)
                result = {"expression": expr, "result": calc_result}
            else:
                result = {"error": "Invalid characters in expression"}

        elif name == "get_current_time":
            now = datetime.now()
            result = {"datetime": now.isoformat(), "date": now.strftime("%Y-%m-%d"), "time": now.strftime("%H:%M:%S")}

        else:
            result = {"error": f"Unknown tool: {name}"}

        return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}

    except Exception as e:
        return {"content": [{"type": "text", "text": json.dumps({"error": str(e)})}], "isError": True}

def handler(event, context):
    """Lambda handler for MCP protocol messages."""
    try:
        # Parse body
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)

        method = body.get('method', '')
        params = body.get('params', {})
        msg_id = body.get('id')

        # Handle MCP methods
        if method == 'initialize':
            result = {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "agentcore-mcp-demo", "version": "0.1.0"}
            }
        elif method == 'tools/list':
            result = get_tools_list()
        elif method == 'tools/call':
            result = call_tool(params.get('name'), params.get('arguments', {}))
        else:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": f"Unknown method: {method}"}})
            }

        response = {"jsonrpc": "2.0", "id": msg_id, "result": result}
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(response)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }
EOF
    filename = "index.py"
  }
}

# Lambda Function URL for direct access (useful for testing)
resource "aws_lambda_function_url" "mcp_server" {
  function_name      = aws_lambda_function.mcp_server.function_name
  authorization_type = "NONE" # For demo - use AWS_IAM in production
}

# Allow API Gateway to invoke (for future gateway integration)
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mcp_server.function_name
  principal     = "apigateway.amazonaws.com"
}

# Allow Bedrock AgentCore to invoke
resource "aws_lambda_permission" "agentcore" {
  statement_id  = "AllowAgentCore"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mcp_server.function_name
  principal     = "bedrock-agentcore.amazonaws.com"
}
