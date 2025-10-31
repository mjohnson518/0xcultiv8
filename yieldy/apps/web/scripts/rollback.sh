#!/bin/bash

# Cultiv8 Emergency Rollback Script
# Rolls back to previous deployment on Vercel

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         CULTIV8 EMERGENCY ROLLBACK                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Confirm rollback
echo -e "${RED}⚠ WARNING: This will rollback to the previous deployment${NC}"
echo ""
read -p "Are you sure you want to rollback? [y/N]: " confirm

if [[ ! $confirm =~ ^[Yy]$ ]]; then
  echo "Rollback cancelled."
  exit 0
fi

echo ""
echo "🔄 Rolling back..."
echo ""

# Get list of recent deployments
echo "Fetching deployment history..."
DEPLOYMENTS=$(vercel ls --json | jq -r '.[0:5] | .[] | "\(.uid) \(.created) \(.state)"')

echo ""
echo "Recent deployments:"
echo "$DEPLOYMENTS"
echo ""

# Get previous deployment ID
PREVIOUS_DEPLOYMENT=$(vercel ls --json | jq -r '.[1].uid')

if [ -z "$PREVIOUS_DEPLOYMENT" ]; then
  echo -e "${RED}✗ No previous deployment found${NC}"
  exit 1
fi

echo "Rolling back to: $PREVIOUS_DEPLOYMENT"
echo ""

# Promote previous deployment to production
if vercel promote "$PREVIOUS_DEPLOYMENT"; then
  echo ""
  echo -e "${GREEN}✅ ROLLBACK SUCCESSFUL${NC}"
  echo ""
  echo "  Previous deployment is now live at:"
  echo "  https://0xcultiv8.vercel.app"
  echo ""
  echo "  Next steps:"
  echo "    1. Verify the application is working"
  echo "    2. Investigate the issue that caused rollback"
  echo "    3. Fix the issue in a new branch"
  echo "    4. Test thoroughly before redeploying"
  echo ""
else
  echo ""
  echo -e "${RED}✗ ROLLBACK FAILED${NC}"
  echo "  Please check Vercel dashboard and attempt manual rollback"
  exit 1
fi

