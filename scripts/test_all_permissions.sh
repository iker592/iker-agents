#!/bin/bash
# Test all IAM permissions for all agent roles
# Usage: ./scripts/test_all_permissions.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGION="${AWS_REGION:-us-east-1}"

echo "=============================================="
echo "  Testing IAM Permissions for All Agents"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}PASS${NC}: $1"; }
fail() { echo -e "${RED}FAIL${NC}: $1"; }
warn() { echo -e "${YELLOW}WARN${NC}: $1"; }

# Get terraform outputs
cd "$(dirname "$SCRIPT_DIR")/terraform"

echo "Getting Terraform outputs..."
MCP_SERVER_ARN=$(terraform output -raw mcp_server_runtime_arn 2>/dev/null) || MCP_SERVER_ARN=""
DSP_MEMORY_ID=$(terraform output -raw dsp_agent_memory_id 2>/dev/null) || DSP_MEMORY_ID=""
CODING_MEMORY_ID=$(terraform output -raw coding_agent_memory_id 2>/dev/null) || CODING_MEMORY_ID=""

cd - > /dev/null

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

assume_role() {
  local role_name="$1"
  local role_arn="arn:aws:iam::${ACCOUNT_ID}:role/${role_name}"

  CREDS=$(aws sts assume-role \
    --role-arn "$role_arn" \
    --role-session-name "perm-test" \
    --duration-seconds 900 \
    --output json 2>/dev/null) || return 1

  export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r '.Credentials.AccessKeyId')
  export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r '.Credentials.SecretAccessKey')
  export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r '.Credentials.SessionToken')
  return 0
}

test_bedrock() {
  aws bedrock-runtime invoke-model \
    --model-id "us.anthropic.claude-3-5-haiku-20241022-v1:0" \
    --content-type "application/json" \
    --accept "application/json" \
    --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":5,"messages":[{"role":"user","content":"Hi"}]}' \
    --region us-west-2 \
    /dev/null 2>&1
}

test_code_interpreter() {
  RESULT=$(aws bedrock-agentcore start-code-interpreter-session \
    --code-interpreter-identifier "aws.codeinterpreter.v1" \
    --region "$REGION" 2>&1) || true

  if echo "$RESULT" | grep -q "AccessDeniedException"; then
    return 1
  fi

  # Stop session if we created one
  SESSION_ID=$(echo "$RESULT" | jq -r '.sessionId' 2>/dev/null) || true
  if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
    aws bedrock-agentcore stop-code-interpreter-session \
      --code-interpreter-identifier "aws.codeinterpreter.v1" \
      --session-id "$SESSION_ID" \
      --region "$REGION" 2>/dev/null || true
  fi
  return 0
}

test_mcp_server() {
  if [ -z "$MCP_SERVER_ARN" ]; then
    return 2  # Skip
  fi

  PAYLOAD='{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
  RESULT=$(echo "$PAYLOAD" | aws bedrock-agentcore invoke-agent-runtime \
    --agent-runtime-arn "$MCP_SERVER_ARN" \
    --qualifier "default" \
    --content-type "application/json" \
    --payload "file:///dev/stdin" \
    --region "$REGION" \
    /dev/stdout 2>&1) || true

  if echo "$RESULT" | grep -q "AccessDeniedException"; then
    return 1
  fi
  return 0
}

test_memory() {
  local memory_id="$1"
  if [ -z "$memory_id" ]; then
    return 2  # Skip
  fi

  RESULT=$(aws bedrock-agentcore list-sessions \
    --memory-id "$memory_id" \
    --max-results 1 \
    --region "$REGION" 2>&1) || true

  if echo "$RESULT" | grep -q "AccessDeniedException"; then
    return 1
  fi
  return 0
}

# Test DSP Agent
echo ""
echo "=== DSP Agent (dsp-agent-tf-runtime-role) ==="
if assume_role "dsp-agent-tf-runtime-role"; then
  test_bedrock && pass "Bedrock InvokeModel" || fail "Bedrock InvokeModel"

  result=$(test_mcp_server; echo $?)
  case $result in
    0) pass "MCP Server Invoke" ;;
    1) fail "MCP Server Invoke" ;;
    2) warn "MCP Server Invoke (skipped - no ARN)" ;;
  esac

  result=$(test_memory "$DSP_MEMORY_ID"; echo $?)
  case $result in
    0) pass "Memory Access" ;;
    1) fail "Memory Access" ;;
    2) warn "Memory Access (skipped - no ID)" ;;
  esac
else
  fail "Could not assume role"
fi

# Test Research Agent
echo ""
echo "=== Research Agent (research-agent-tf-runtime-role) ==="
if assume_role "research-agent-tf-runtime-role"; then
  test_bedrock && pass "Bedrock InvokeModel" || fail "Bedrock InvokeModel"
else
  fail "Could not assume role"
fi

# Test Coding Agent
echo ""
echo "=== Coding Agent (coding-agent-tf-runtime-role) ==="
if assume_role "coding-agent-tf-runtime-role"; then
  test_bedrock && pass "Bedrock InvokeModel" || fail "Bedrock InvokeModel"
  test_code_interpreter && pass "Code Interpreter" || fail "Code Interpreter"

  result=$(test_memory "$CODING_MEMORY_ID"; echo $?)
  case $result in
    0) pass "Memory Access" ;;
    1) fail "Memory Access" ;;
    2) warn "Memory Access (skipped - no ID)" ;;
  esac
else
  fail "Could not assume role"
fi

echo ""
echo "=============================================="
echo "Done!"
