#!/bin/bash
set -e

# Update UI with correct API URL and redeploy to S3
# This script is useful when you've made UI changes and need to redeploy
# without redeploying the entire CDK stack

STACK_SUFFIX=""
if [ "$1" = "--preview" ] && [ -n "$2" ]; then
  STACK_SUFFIX="-PR$2"
  echo "🔄 Updating preview deployment for PR $2..."
else
  echo "🔄 Updating production UI deployment..."
fi

# Get stack outputs
OUTPUTS_FILE="cdk-outputs${STACK_SUFFIX}.json"
if [ ! -f "$OUTPUTS_FILE" ]; then
  echo "❌ Error: $OUTPUTS_FILE not found. Please run 'cdk deploy' first."
  exit 1
fi

echo "🔍 Extracting deployment info from $OUTPUTS_FILE..."
API_URL=$(cat "$OUTPUTS_FILE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('UIStack${STACK_SUFFIX}', {}).get('APIURL', ''))")
BUCKET_NAME=$(cat "$OUTPUTS_FILE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('UIStack${STACK_SUFFIX}', {}).get('UIBucketName', ''))")

if [ -z "$API_URL" ]; then
  echo "❌ Error: Could not extract API URL from outputs"
  exit 1
fi

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ Error: Could not extract bucket name from outputs"
  exit 1
fi

echo "✅ API URL: $API_URL"
echo "✅ S3 Bucket: $BUCKET_NAME"

echo "📦 Installing UI dependencies..."
cd ui
bun install

echo "🔨 Building UI with API URL..."
VITE_API_URL=$API_URL bun run build

echo "📤 Uploading to S3..."
aws s3 sync dist/ s3://$BUCKET_NAME/ --delete

echo "🔄 Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[0].DomainName=='$BUCKET_NAME.s3.amazonaws.com'].Id | [0]" --output text)

if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
  aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
  echo "✅ CloudFront cache invalidated (may take a few minutes to propagate)"
else
  echo "⚠️  Warning: Could not find CloudFront distribution ID"
fi

UI_URL=$(cat ../"$OUTPUTS_FILE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('UIStack${STACK_SUFFIX}', {}).get('UIDistributionURL', ''))")

echo ""
echo "✅ UI update complete!"
echo ""
echo "🌐 UI URL: $UI_URL"
echo "🔌 API URL: $API_URL"
echo ""
echo "Note: CloudFront changes may take a few minutes to propagate globally."
