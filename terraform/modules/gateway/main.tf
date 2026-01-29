# AgentCore MCP Gateway Module
# Creates Gateway + Lambda Target for MCP tools

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.id
}

# ============================================================================
# IAM Roles
# ============================================================================

# Gateway Role
resource "aws_iam_role" "gateway" {
  name = "${var.name}-gateway-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock-agentcore.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Gateway policy to invoke Lambda
resource "aws_iam_role_policy" "gateway_lambda" {
  name = "lambda-invoke"
  role = aws_iam_role.gateway.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = aws_lambda_function.mcp_server.arn
      }
    ]
  })
}

# Lambda Role
resource "aws_iam_role" "mcp_lambda" {
  name = "${var.name}-lambda-role"

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

# ============================================================================
# MCP Lambda Function
# ============================================================================

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

# Mock Data Store
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

def get_tools_list():
    return {
        "tools": [
            {"name": "get_customer", "description": "Get customer details by ID", "inputSchema": {"type": "object", "properties": {"customer_id": {"type": "string", "description": "Customer ID"}}, "required": ["customer_id"]}},
            {"name": "list_customers", "description": "List all customers, optionally filtered by tier", "inputSchema": {"type": "object", "properties": {"tier": {"type": "string", "description": "Filter by tier"}}}},
            {"name": "search_customers", "description": "Search customers by name or email", "inputSchema": {"type": "object", "properties": {"query": {"type": "string", "description": "Search query"}}, "required": ["query"]}},
            {"name": "get_order", "description": "Get order details by ID", "inputSchema": {"type": "object", "properties": {"order_id": {"type": "string", "description": "Order ID"}}, "required": ["order_id"]}},
            {"name": "list_orders", "description": "List orders, optionally filtered", "inputSchema": {"type": "object", "properties": {"customer_id": {"type": "string"}, "status": {"type": "string"}}}},
            {"name": "get_analytics", "description": "Get business analytics and KPIs", "inputSchema": {"type": "object", "properties": {}}},
            {"name": "get_revenue_forecast", "description": "Get revenue forecast", "inputSchema": {"type": "object", "properties": {"months": {"type": "integer", "description": "Months to forecast"}}}}
        ]
    }

def call_tool(name, arguments):
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
            if arguments.get("customer_id"):
                orders = [o for o in orders if o["customer_id"] == arguments["customer_id"]]
            if arguments.get("status"):
                orders = [o for o in orders if o["status"] == arguments["status"]]
            for o in orders:
                o["total"] = sum(i["quantity"] * i["price"] for i in o["items"])
            result = {"orders": orders, "total": len(orders)}
        elif name == "get_analytics":
            result = {"metrics": MOCK_ANALYTICS, "generated_at": datetime.now().isoformat()}
        elif name == "get_revenue_forecast":
            months = arguments.get("months", 3)
            base = MOCK_ANALYTICS["monthly_revenue"]
            forecast = []
            now = datetime.now()
            for i in range(months):
                future = now + timedelta(days=30 * (i + 1))
                projected = base * ((1 + 0.05) ** (i + 1))
                forecast.append({"month": future.strftime("%Y-%m"), "projected_revenue": round(projected, 2)})
            result = {"base_revenue": base, "growth_rate": "5%", "forecast": forecast}
        else:
            result = {"error": f"Unknown tool: {name}"}
        return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
    except Exception as e:
        return {"content": [{"type": "text", "text": json.dumps({"error": str(e)})}], "isError": True}

def handler(event, context):
    try:
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)
        method = body.get('method', '')
        params = body.get('params', {})
        msg_id = body.get('id')

        if method == 'initialize':
            result = {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "serverInfo": {"name": "agentcore-mcp", "version": "1.0.0"}}
        elif method == 'tools/list':
            result = get_tools_list()
        elif method == 'tools/call':
            result = call_tool(params.get('name'), params.get('arguments', {}))
        else:
            return {"statusCode": 400, "headers": {"Content-Type": "application/json"}, "body": json.dumps({"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": f"Unknown method: {method}"}})}

        return {"statusCode": 200, "headers": {"Content-Type": "application/json"}, "body": json.dumps({"jsonrpc": "2.0", "id": msg_id, "result": result})}
    except Exception as e:
        return {"statusCode": 500, "headers": {"Content-Type": "application/json"}, "body": json.dumps({"error": str(e)})}
EOF
    filename = "index.py"
  }
}

# Lambda permission for Gateway
resource "aws_lambda_permission" "gateway" {
  statement_id  = "AllowGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mcp_server.function_name
  principal     = "bedrock-agentcore.amazonaws.com"
}

# ============================================================================
# AgentCore Gateway
# ============================================================================

resource "aws_bedrockagentcore_gateway" "mcp" {
  name     = "${var.name}-gateway"
  role_arn = aws_iam_role.gateway.arn

  authorizer_type = var.cognito_user_pool_id != "" ? "CUSTOM_JWT" : "NONE"

  dynamic "authorizer_configuration" {
    for_each = var.cognito_user_pool_id != "" ? [1] : []
    content {
      custom_jwt_authorizer {
        discovery_url    = "https://cognito-idp.${local.region}.amazonaws.com/${var.cognito_user_pool_id}/.well-known/openid-configuration"
        allowed_audience = var.cognito_client_ids
        allowed_clients  = var.cognito_client_ids
      }
    }
  }

  protocol_type = "MCP"

  tags = var.tags
}

# ============================================================================
# Gateway Targets (Lambda) - One target per tool for MCP protocol
# ============================================================================

resource "aws_bedrockagentcore_gateway_target" "get_customer" {
  name               = "${var.name}-get-customer"
  gateway_identifier = aws_bedrockagentcore_gateway.mcp.gateway_id
  description        = "Get customer details by ID"

  credential_provider_configuration {
    gateway_iam_role {}
  }

  # Ensure IAM policy propagates before creating target
  depends_on = [aws_iam_role_policy.gateway_lambda, aws_lambda_permission.gateway]

  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.mcp_server.arn
        tool_schema {
          inline_payload {
            name        = "get_customer"
            description = "Get customer details by ID including name, email, tier, and balance"
            input_schema {
              type = "object"
              property {
                name        = "customer_id"
                type        = "string"
                description = "Customer ID (e.g., cust-001)"
                required    = true
              }
            }
          }
        }
      }
    }
  }
}

resource "aws_bedrockagentcore_gateway_target" "list_customers" {
  name               = "${var.name}-list-customers"
  gateway_identifier = aws_bedrockagentcore_gateway.mcp.gateway_id
  description        = "List all customers"

  credential_provider_configuration {
    gateway_iam_role {}
  }

  # Ensure IAM policy propagates before creating target
  depends_on = [aws_iam_role_policy.gateway_lambda, aws_lambda_permission.gateway]

  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.mcp_server.arn
        tool_schema {
          inline_payload {
            name        = "list_customers"
            description = "List all customers, optionally filtered by tier (enterprise, growth, starter)"
            input_schema {
              type = "object"
              property {
                name        = "tier"
                type        = "string"
                description = "Filter by tier: enterprise, growth, or starter"
              }
            }
          }
        }
      }
    }
  }
}

resource "aws_bedrockagentcore_gateway_target" "get_analytics" {
  name               = "${var.name}-get-analytics"
  gateway_identifier = aws_bedrockagentcore_gateway.mcp.gateway_id
  description        = "Get business analytics"

  credential_provider_configuration {
    gateway_iam_role {}
  }

  # Ensure IAM policy propagates before creating target
  depends_on = [aws_iam_role_policy.gateway_lambda, aws_lambda_permission.gateway]

  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.mcp_server.arn
        tool_schema {
          inline_payload {
            name        = "get_analytics"
            description = "Get current business KPIs: daily active users, monthly revenue, churn rate, NPS score, support tickets"
            input_schema {
              type = "object"
            }
          }
        }
      }
    }
  }
}

resource "aws_bedrockagentcore_gateway_target" "list_orders" {
  name               = "${var.name}-list-orders"
  gateway_identifier = aws_bedrockagentcore_gateway.mcp.gateway_id
  description        = "List orders"

  credential_provider_configuration {
    gateway_iam_role {}
  }

  # Ensure IAM policy propagates before creating target
  depends_on = [aws_iam_role_policy.gateway_lambda, aws_lambda_permission.gateway]

  target_configuration {
    mcp {
      lambda {
        lambda_arn = aws_lambda_function.mcp_server.arn
        tool_schema {
          inline_payload {
            name        = "list_orders"
            description = "List orders with optional customer_id and status filters"
            input_schema {
              type = "object"
              property {
                name        = "customer_id"
                type        = "string"
                description = "Filter by customer ID"
              }
              property {
                name        = "status"
                type        = "string"
                description = "Filter by status: pending, processing, completed"
              }
            }
          }
        }
      }
    }
  }
}
