# UI Deployment Guide

This guide explains how to deploy the agent management UI to AWS using CDK.

## Overview

The UI is now deployed to AWS using:
- **S3** for static file hosting
- **CloudFront** for CDN distribution
- **API Gateway** for agent invocation
- **Lambda** for request proxying to Bedrock AgentCore runtimes

## Architecture

```
User Browser
    ↓
CloudFront (CDN)
    ↓
S3 (Static UI Files)
    ↓
API Gateway (/agents, /invoke)
    ↓
Lambda Proxy (CORS, request transformation)
    ↓
Bedrock AgentCore Runtimes (DSP, Research, Coding agents)
```

## Quick Start

### Option 1: Automated Deployment (Recommended)

The UI is automatically deployed when you push to the `main` branch via GitHub Actions.

### Option 2: Manual Deployment

```bash
# Ensure AWS credentials are configured
aws configure

# Run the deployment script
./scripts/deploy_ui.sh
```

### Option 3: CDK Direct

```bash
# Install UI dependencies
cd ui && bun install && cd ..

# Build UI (initial)
cd ui && VITE_API_URL=placeholder bun run build && cd ..

# Deploy all stacks
cdk deploy --all --require-approval never --outputs-file cdk-outputs.json

# Rebuild UI with actual API URL
API_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin)['UIStack']['APIURL'])")
cd ui && VITE_API_URL=$API_URL bun run build

# Manually sync to S3
BUCKET=$(cat ../cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin)['UIStack']['UIBucketName'])")
aws s3 sync dist/ s3://$BUCKET/ --delete
```

## What Gets Deployed

1. **UIStack** (new):
   - S3 bucket for UI files
   - CloudFront distribution
   - API Gateway REST API
   - Lambda function for agent invocation

2. **Agent Stacks** (existing):
   - DSPAgentStack
   - ResearchAgentStack
   - CodingAgentStack

## API Endpoints

### GET /agents
Returns list of available agents:
```json
{
  "agents": [
    {
      "id": "dsp",
      "name": "Dsp",
      "runtime_arn": "arn:aws:...",
      "status": "active"
    },
    ...
  ]
}
```

### POST /invoke
Invokes an agent with AG-UI protocol support:
```json
{
  "agent_id": "dsp",
  "input": "What is 2+2?",
  "session_id": "session-123",
  "user_id": "user-456",
  "stream_agui": true
}
```

Response:
```json
{
  "output": "The answer is 4.",
  "session_id": "session-123",
  "events": [
    {"type": "thinking", "data": "..."},
    {"type": "toolUse", "data": "..."},
    {"type": "content", "data": "..."}
  ]
}
```

## Environment Variables

The UI uses the following environment variable:

- `VITE_API_URL`: API Gateway URL (set automatically during deployment)

## Testing

### 1. Test Agent List

```bash
# Get API URL from CDK outputs
API_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin)['UIStack']['APIURL'])")

# Test agents endpoint
curl "$API_URL/agents"
```

### 2. Test Agent Invocation

```bash
# Invoke DSP agent
curl -X POST "$API_URL/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "dsp",
    "input": "What is 2+2?",
    "stream_agui": true
  }'
```

### 3. Test UI

```bash
# Get UI URL from CDK outputs
UI_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin)['UIStack']['UIDistributionURL'])")

# Open in browser
echo "UI URL: $UI_URL"
```

Expected behavior:
1. Dashboard loads with agent cards
2. Clicking "View all" shows agents page
3. All agents are listed (DSP, Research, Coding)
4. Clicking an agent card navigates to details
5. Chat interface allows sending messages
6. Agents respond with calculated results

## AG-UI Protocol

The Lambda proxy supports AG-UI protocol which provides rich event streams:

- **thinking**: Agent's internal reasoning
- **toolUse**: Tool invocation events
- **content**: Response content chunks
- **metadata**: Additional context

To enable AG-UI protocol, set `stream_agui: true` in the request.

## Troubleshooting

### UI not loading
- Check CloudFront distribution status
- Verify S3 bucket has correct files
- Check browser console for errors

### API errors
- Verify Lambda has correct IAM permissions
- Check Lambda logs in CloudWatch
- Ensure runtime ARNs are correct

### Agent invocation fails
- Verify agent runtimes are deployed
- Check endpoint names match (dev, canary, prod)
- Review Bedrock AgentCore logs

### CORS errors
- API Gateway has CORS enabled by default
- Check browser network tab for preflight requests
- Verify Lambda returns correct CORS headers

## Updating the UI

After making UI changes:

```bash
cd ui
bun run build
BUCKET=$(cat ../cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin)['UIStack']['UIBucketName'])")
aws s3 sync dist/ s3://$BUCKET/ --delete

# Invalidate CloudFront cache
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[0].DomainName=='$BUCKET.s3.amazonaws.com'].Id | [0]" --output text)
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
```

## Cost Estimates

- S3: ~$0.023/GB/month
- CloudFront: ~$0.085/GB (first 10TB)
- API Gateway: $3.50/million requests
- Lambda: $0.20/million requests + compute time
- Bedrock AgentCore: Pay per invocation

Typical cost for light usage: **< $5/month**

## Security

- S3 bucket is public for website hosting
- API has CORS enabled for browser access
- Lambda has minimal IAM permissions
- Consider adding:
  - API Gateway authentication (Cognito)
  - WAF rules
  - CloudFront signed URLs

## Next Steps

1. Add authentication (Cognito)
2. Implement real-time streaming (WebSockets)
3. Add metrics and monitoring (CloudWatch)
4. Set up custom domain (Route53)
5. Enable access logs
