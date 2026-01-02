# 0xCultiv8 Staging Variables
# Terraform variable definitions for staging environment

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "cultiv8"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

# Application Configuration
variable "app_port" {
  description = "Application port"
  type        = number
  default     = 4000
}

variable "health_check_path" {
  description = "Health check endpoint path"
  type        = string
  default     = "/api/health"
}

# Database Configuration (Neon is external, so just connection info)
variable "database_connection_secret_name" {
  description = "Name of the secret containing database connection string"
  type        = string
  default     = "cultiv8/staging/database-url"
}

# Blockchain RPC Configuration
variable "ethereum_rpc_secret_name" {
  description = "Name of the secret containing Ethereum RPC URL"
  type        = string
  default     = "cultiv8/staging/ethereum-rpc"
}

variable "base_rpc_secret_name" {
  description = "Name of the secret containing Base RPC URL"
  type        = string
  default     = "cultiv8/staging/base-rpc"
}

# API Keys (stored in Secrets Manager)
variable "anthropic_api_key_secret_name" {
  description = "Name of the secret containing Anthropic API key"
  type        = string
  default     = "cultiv8/staging/anthropic-api-key"
}

variable "openai_api_key_secret_name" {
  description = "Name of the secret containing OpenAI API key"
  type        = string
  default     = "cultiv8/staging/openai-api-key"
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
