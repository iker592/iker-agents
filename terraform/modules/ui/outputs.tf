# UI Module Outputs

output "bucket_name" {
  description = "S3 bucket name for UI files"
  value       = aws_s3_bucket.ui.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.ui.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.ui.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = aws_cloudfront_distribution.ui.domain_name
}

output "ui_url" {
  description = "UI URL (CloudFront)"
  value       = "https://${aws_cloudfront_distribution.ui.domain_name}"
}

output "api_url" {
  description = "API Gateway URL"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.proxy.function_name
}
