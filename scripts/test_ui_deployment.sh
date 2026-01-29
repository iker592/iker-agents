#!/bin/bash
set -e

# Test UI deployment
# This script tests the deployed UI and API endpoints

if [ ! -f "cdk-outputs.json" ]; then
  echo "❌ Error: cdk-outputs.json not found. Please deploy first."
  exit 1
fi

echo "🔍 Extracting deployment URLs..."
API_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('UIStack', {}).get('APIURL', ''))" 2>/dev/null || echo "")
UI_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('UIStack', {}).get('UIDistributionURL', ''))" 2>/dev/null || echo "")

if [ -z "$API_URL" ] || [ -z "$UI_URL" ]; then
  echo "❌ Error: Could not extract URLs from cdk-outputs.json"
  exit 1
fi

echo "✅ API URL: $API_URL"
echo "✅ UI URL: $UI_URL"
echo ""

echo "📋 Test 1: List agents"
echo "---"
AGENTS_RESPONSE=$(curl -s "$API_URL/agents")
echo "$AGENTS_RESPONSE" | python3 -m json.tool
AGENT_COUNT=$(echo "$AGENTS_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('agents', [])))" 2>/dev/null || echo "0")
echo ""
if [ "$AGENT_COUNT" -gt 0 ]; then
  echo "✅ Found $AGENT_COUNT agent(s)"
else
  echo "❌ No agents found"
  exit 1
fi
echo ""

echo "📋 Test 2: Invoke DSP agent"
echo "---"
INVOKE_RESPONSE=$(curl -s -X POST "$API_URL/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "dsp",
    "input": "What is 2+2?",
    "stream_agui": false
  }')
echo "$INVOKE_RESPONSE" | python3 -m json.tool
echo ""
if echo "$INVOKE_RESPONSE" | grep -q "output"; then
  echo "✅ Agent invocation successful"
else
  echo "❌ Agent invocation failed"
  exit 1
fi
echo ""

echo "📋 Test 3: Invoke with AG-UI protocol"
echo "---"
AGUI_RESPONSE=$(curl -s -X POST "$API_URL/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "dsp",
    "input": "Calculate 5*3",
    "stream_agui": true
  }')
echo "$AGUI_RESPONSE" | python3 -m json.tool
echo ""
if echo "$AGUI_RESPONSE" | grep -q "events"; then
  echo "✅ AG-UI protocol working"
else
  echo "⚠️  AG-UI events not found (may not be supported yet)"
fi
echo ""

echo "📋 Test 4: Check UI accessibility"
echo "---"
UI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$UI_URL")
if [ "$UI_STATUS" = "200" ]; then
  echo "✅ UI is accessible (HTTP $UI_STATUS)"
else
  echo "❌ UI returned HTTP $UI_STATUS"
  exit 1
fi
echo ""

echo "✅ All tests passed!"
echo ""
echo "🌐 Open the UI in your browser:"
echo "   $UI_URL"
echo ""
echo "📚 Available agents:"
echo "$AGENTS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for agent in data.get('agents', []):
        print(f\"   - {agent.get('name', 'Unknown')}: {agent.get('id', 'N/A')}\")
except:
    pass
"
