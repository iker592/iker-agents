#!/bin/bash
# Quick test for Code Interpreter permissions
# Usage: ./scripts/test_code_interpreter.sh [role-name]

set -e

ROLE_NAME="${1:-coding-agent-tf-runtime-role}"
REGION="${AWS_REGION:-us-east-1}"

echo "Testing Code Interpreter permissions for role: $ROLE_NAME"
echo "Region: $REGION"
echo "=================================================="

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "Assuming role: $ROLE_ARN"

# Assume the role
CREDS=$(aws sts assume-role \
  --role-arn "$ROLE_ARN" \
  --role-session-name "code-interpreter-test" \
  --duration-seconds 900 \
  --output json)

export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r '.Credentials.SessionToken')

echo "Role assumed successfully"
echo ""

# Test StartCodeInterpreterSession
echo "Testing: StartCodeInterpreterSession"
echo "-------------------------------------"

RESULT=$(aws bedrock-agentcore start-code-interpreter-session \
  --code-interpreter-identifier "aws.codeinterpreter.v1" \
  --region "$REGION" 2>&1) || true

if echo "$RESULT" | grep -q "AccessDeniedException"; then
  echo "FAIL: AccessDeniedException"
  echo "$RESULT" | head -5
  exit 1
elif echo "$RESULT" | grep -q "sessionId"; then
  SESSION_ID=$(echo "$RESULT" | jq -r '.sessionId')
  echo "PASS: Session created: $SESSION_ID"

  # Try to execute code
  echo ""
  echo "Testing: ExecuteCode"
  echo "--------------------"

  EXEC_RESULT=$(aws bedrock-agentcore execute-code \
    --code-interpreter-identifier "aws.codeinterpreter.v1" \
    --session-id "$SESSION_ID" \
    --code "print('Hello from Code Interpreter!')" \
    --language "PYTHON" \
    --region "$REGION" 2>&1) || true

  if echo "$EXEC_RESULT" | grep -q "AccessDeniedException"; then
    echo "FAIL: AccessDeniedException on ExecuteCode"
  else
    echo "PASS: Code executed"
    echo "$EXEC_RESULT" | jq -r '.output // .error // "No output"' 2>/dev/null || echo "$EXEC_RESULT"
  fi

  # Stop the session
  echo ""
  echo "Testing: StopCodeInterpreterSession"
  echo "------------------------------------"

  STOP_RESULT=$(aws bedrock-agentcore stop-code-interpreter-session \
    --code-interpreter-identifier "aws.codeinterpreter.v1" \
    --session-id "$SESSION_ID" \
    --region "$REGION" 2>&1) || true

  if echo "$STOP_RESULT" | grep -q "AccessDeniedException"; then
    echo "FAIL: AccessDeniedException on StopCodeInterpreterSession"
  else
    echo "PASS: Session stopped"
  fi
else
  echo "Got response (not AccessDeniedException - permission likely OK):"
  echo "$RESULT" | head -5
fi

echo ""
echo "=================================================="
echo "Done!"
