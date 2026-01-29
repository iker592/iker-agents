terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.18.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.0"
    }
  }

  backend "s3" {
    bucket         = "iker-agents-terraform-state"
    key            = "iker-agents/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "iker-agents-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}
