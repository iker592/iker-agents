#!/bin/bash
set -e

# Deploy UI to AWS with CDK
# This script deploys the UI stack and updates the UI with the API URL

echo "📦 Installing UI dependencies..."
cd ui
bun install

echo "🔨 Building UI (initial build)..."
VITE_API_URL=placeholder bun run build
cd ..

echo "🚀 Deploying CDK stacks..."
cdk deploy --all --require-approval never --outputs-file cdk-outputs.json

echo "🔍 Extracting API URL from outputs..."
API_URL=$(cat cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('UIStack', {}).get('APIURL', ''))")

if [ -z "$API_URL" ]; then
  echo "❌ Error: Could not extract API URL from CDK outputs"
  exit 1
fi

echo "✅ API URL: $API_URL"

echo "🔨 Rebuilding UI with actual API URL..."
cd ui
VITE_API_URL=$API_URL bun run build

echo "📤 Uploading UI to S3..."
BUCKET_NAME=$(cat ../cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('UIStack', {}).get('UIBucketName', ''))")

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ Error: Could not extract bucket name from CDK outputs"
  exit 1
fi

aws s3 sync dist/ s3://$BUCKET_NAME/ --delete

echo "🔄 Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[0].DomainName=='$BUCKET_NAME.s3.amazonaws.com'].Id | [0]" --output text)

if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
  aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
  echo "✅ CloudFront cache invalidated"
else
  echo "⚠️  Warning: Could not find CloudFront distribution ID"
fi

UI_URL=$(cat ../cdk-outputs.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('UIStack', {}).get('UIDistributionURL', ''))")

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 UI URL: $UI_URL"
echo "🔌 API URL: $API_URL"
echo ""
echo "Available agents:"
cat ../cdk-outputs.json | python3 -c "
import sys, json
outputs = json.load(sys.stdin)
for stack in ['DSPAgentStack', 'ResearchAgentStack', 'CodingAgentStack']:
    if stack in outputs:
        runtime_name = outputs[stack].get('RuntimeName', stack)
        runtime_arn = outputs[stack].get('RuntimeArn', 'N/A')
        print(f'  - {runtime_name}: {runtime_arn}')
"
