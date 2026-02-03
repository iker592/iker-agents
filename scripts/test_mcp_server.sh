#!/bin/bash
# Quick test for MCP Server invocation permissions
# Usage: ./scripts/test_mcp_server.sh [role-name] [mcp-server-arn]

set -e

ROLE_NAME="${1:-dsp-agent-tf-runtime-role}"
REGION="${AWS_REGION:-us-east-1}"

# Try to get MCP Server ARN from terraform if not provided
if [ -z "$2" ]; then
  if [ -d "terraform" ]; then
    MCP_SERVER_ARN=$(cd terraform && terraform output -raw mcp_server_runtime_arn 2>/dev/null) || true
  fi
else
  MCP_SERVER_ARN="$2"
fi

if [ -z "$MCP_SERVER_ARN" ]; then
  echo "ERROR: MCP Server ARN not provided and couldn't get from terraform"
  echo "Usage: $0 [role-name] [mcp-server-arn]"
  exit 1
fi

echo "Testing MCP Server invocation for role: $ROLE_NAME"
echo "MCP Server ARN: $MCP_SERVER_ARN"
echo "Region: $REGION"
echo "=================================================="

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "Assuming role: $ROLE_ARN"

# Assume the role
CREDS=$(aws sts assume-role \
  --role-arn "$ROLE_ARN" \
  --role-session-name "mcp-server-test" \
  --duration-seconds 900 \
  --output json)

export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r '.Credentials.SessionToken')

echo "Role assumed successfully"
echo ""

# Test InvokeAgentRuntime
echo "Testing: InvokeAgentRuntime (tools/list)"
echo "-----------------------------------------"

# Create temp file for payload
PAYLOAD_FILE=$(mktemp)
cat > "$PAYLOAD_FILE" << 'EOF'
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
EOF

RESULT=$(aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn "$MCP_SERVER_ARN" \
  --qualifier "default" \
  --content-type "application/json" \
  --payload "file://$PAYLOAD_FILE" \
  --region "$REGION" \
  /dev/stdout 2>&1) || true

rm -f "$PAYLOAD_FILE"

if echo "$RESULT" | grep -q "AccessDeniedException"; then
  echo "FAIL: AccessDeniedException"
  echo "$RESULT" | head -10
  exit 1
else
  echo "PASS: Successfully invoked MCP Server"
  # Try to parse the response
  if echo "$RESULT" | jq -e '.tools' > /dev/null 2>&1; then
    echo ""
    echo "Available tools:"
    echo "$RESULT" | jq -r '.tools[].name' 2>/dev/null || echo "$RESULT"
  else
    echo "Response:"
    echo "$RESULT" | head -20
  fi
fi

echo ""
echo "=================================================="
echo "Done!"
