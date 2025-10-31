#!/bin/bash

# Cultiv8 Deployment Script
# Deploys to Vercel with safety checks

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         CULTIV8 VERCEL DEPLOYMENT                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo -e "${RED}✗ Vercel CLI not found${NC}"
  echo "  Install with: npm install -g vercel"
  exit 1
fi

# Run pre-deployment checks
echo -e "${BLUE}Step 1: Running pre-deployment checks...${NC}"
echo ""

if ! ./scripts/pre-deploy.sh; then
  echo ""
  echo -e "${RED}Pre-deployment checks failed. Aborting deployment.${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
echo ""

# Prompt for deployment environment
echo -e "${YELLOW}Select deployment environment:${NC}"
echo "  1) Production (0xcultiv8.vercel.app)"
echo "  2) Preview (auto-generated URL)"
echo ""
read -p "Enter choice [1-2]: " env_choice

case $env_choice in
  1)
    DEPLOY_ENV="production"
    DEPLOY_FLAGS="--prod"
    ;;
  2)
    DEPLOY_ENV="preview"
    DEPLOY_FLAGS=""
    ;;
  *)
    echo -e "${RED}Invalid choice. Aborting.${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}Step 2: Deploying to $DEPLOY_ENV...${NC}"
echo ""

# Show current git status
echo "  Current branch: $(git branch --show-current)"
echo "  Last commit: $(git log -1 --oneline)"
echo ""

# Confirm deployment
read -p "Proceed with deployment to $DEPLOY_ENV? [y/N]: " confirm

if [[ ! $confirm =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 0
fi

echo ""
echo "🚀 Deploying..."
echo ""

# Deploy to Vercel
if vercel $DEPLOY_FLAGS; then
  echo ""
  echo -e "${GREEN}✅ Deployment successful!${NC}"
  echo ""
  
  # Get deployment URL
  if [ "$DEPLOY_ENV" = "production" ]; then
    DEPLOY_URL="https://0xcultiv8.vercel.app"
  else
    DEPLOY_URL=$(vercel inspect --json | jq -r '.url')
  fi
  
  echo "  Deployment URL: $DEPLOY_URL"
  echo ""
  
  # Run post-deployment checks
  echo -e "${BLUE}Step 3: Running post-deployment checks...${NC}"
  echo ""
  
  if ./scripts/post-deploy.sh "$DEPLOY_URL"; then
    echo ""
    echo -e "${GREEN}✅ Post-deployment checks passed${NC}"
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  🎉 DEPLOYMENT COMPLETE!"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "  URL: $DEPLOY_URL"
    echo "  Environment: $DEPLOY_ENV"
    echo "  Status: Live"
    echo ""
    echo "  Next steps:"
    echo "    1. Test the deployed application"
    echo "    2. Monitor error logs in Vercel dashboard"
    echo "    3. Check database connections"
    echo "    4. Verify API endpoints responding"
    echo ""
  else
    echo ""
    echo -e "${YELLOW}⚠ Post-deployment checks had warnings${NC}"
    echo "  Check the logs above for details"
    echo ""
  fi
else
  echo ""
  echo -e "${RED}✗ Deployment failed${NC}"
  echo "  Check the error messages above"
  exit 1
fi

