# Terraform state backend configuration
# Uncomment and configure for shared state across CI/CD
# You need to create the S3 bucket and DynamoDB table first:
#   aws s3 mb s3://iker-agents-terraform-state
#   aws dynamodb create-table --table-name terraform-state-lock \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST

# terraform {
#   backend "s3" {
#     bucket         = "iker-agents-terraform-state"
#     key            = "dsp-agent/terraform.tfstate"
#     region         = "us-east-1"
#     encrypt        = true
#     dynamodb_table = "terraform-state-lock"
#   }
# }
