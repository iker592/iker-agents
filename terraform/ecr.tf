# ECR Repository for agent Docker images
resource "aws_ecr_repository" "agent" {
  name                 = "iker-agents/dsp-agent"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

# Lifecycle policy to keep only recent images
resource "aws_ecr_lifecycle_policy" "agent" {
  repository = aws_ecr_repository.agent.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Output the repository URL for CI/CD
output "ecr_repository_url" {
  description = "ECR repository URL for pushing Docker images"
  value       = aws_ecr_repository.agent.repository_url
}

# ECR Repository for MCP Server
resource "aws_ecr_repository" "mcp_server" {
  count                = var.deploy_mcp_server ? 1 : 0
  name                 = "iker-agents/mcp-server"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "mcp_server" {
  count      = var.deploy_mcp_server ? 1 : 0
  repository = aws_ecr_repository.mcp_server[0].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

output "mcp_server_ecr_repository_url" {
  description = "ECR repository URL for MCP server"
  value       = var.deploy_mcp_server ? aws_ecr_repository.mcp_server[0].repository_url : null
}
