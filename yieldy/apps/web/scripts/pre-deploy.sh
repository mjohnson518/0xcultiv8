#!/bin/bash

# Cultiv8 Pre-Deployment Checks
# Runs before deployment to Vercel
# Ensures all requirements are met

set -e # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     CULTIV8 PRE-DEPLOYMENT CHECKS                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to check requirement
check() {
  local name=$1
  local command=$2
  
  echo -n "  Checking $name... "
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    ((CHECKS_FAILED++))
    return 1
  fi
}

# Function to check environment variable
check_env() {
  local name=$1
  
  echo -n "  Checking ENV: $name... "
  
  if [ -z "${!name}" ]; then
    echo -e "${YELLOW}⚠ NOT SET${NC}"
    return 1
  else
    echo -e "${GREEN}✓ SET${NC}"
    ((CHECKS_PASSED++))
    return 0
  fi
}

echo "1. Environment Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check "Node.js version" "node --version | grep -E 'v(18|20|22)'"
check "npm installed" "npm --version"
check "Git repository" "git rev-parse --git-dir"

echo ""
echo "2. Required Environment Variables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Critical variables
check_env "DATABASE_URL" || echo "    ⚠ Set in Vercel dashboard"
check_env "UPSTASH_REDIS_REST_URL" || echo "    ⚠ Set in Vercel dashboard"
check_env "UPSTASH_REDIS_REST_TOKEN" || echo "    ⚠ Set in Vercel dashboard"
check_env "ANTHROPIC_API_KEY" || echo "    ⚠ Set in Vercel dashboard"
check_env "ETHEREUM_RPC_URL" || echo "    ⚠ Set in Vercel dashboard"
check_env "BASE_RPC_URL" || echo "    ⚠ Set in Vercel dashboard"

echo ""
echo "3. Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check "package.json exists" "test -f package.json"
check "node_modules exists" "test -d node_modules"

echo ""
echo "4. Running Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if check "Fee calculator tests" "node test/feeCalculator.test.js"; then
  echo "    Revenue model validated ✓"
fi

if check "Integration tests" "node test/integration.test.js"; then
  echo "    User journeys validated ✓"
fi

echo ""
echo "5. Build Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "  Testing build process..."
if npm run build > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓ Build successful${NC}"
  ((CHECKS_PASSED++))
else
  echo -e "  ${RED}✗ Build failed${NC}"
  ((CHECKS_FAILED++))
fi

echo ""
echo "6. Security Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check ".env files not committed" "! git ls-files | grep -E '\.env$|\.env\.production$'"
check ".gitignore exists" "test -f .gitignore"
check "No TODO/FIXME in critical files" "! grep -r 'TODO\|FIXME' src/app/api/fees/ src/app/api/user/"

echo ""
echo "7. File Integrity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check "vercel.json exists" "test -f vercel.json"
check "Database migrations exist" "test -f migrations/004_add_fee_tiers.sql"
check "Fee calculator exists" "test -f src/utils/feeCalculator.js"
check "All API routes exist" "test -d src/app/api/fees && test -d src/app/api/user"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "════════════════════════════════════════════════════════════"
echo ""

TOTAL=$((CHECKS_PASSED + CHECKS_FAILED))
SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($CHECKS_PASSED/$TOTAL)*100}")

echo "  Tests Passed: $CHECKS_PASSED"
echo "  Tests Failed: $CHECKS_FAILED"
echo "  Success Rate: $SUCCESS_RATE%"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL PRE-DEPLOYMENT CHECKS PASSED${NC}"
  echo ""
  echo "  Ready to deploy to Vercel!"
  echo "  Run: ./scripts/deploy.sh"
  echo ""
  exit 0
else
  echo -e "${RED}❌ SOME CHECKS FAILED${NC}"
  echo ""
  echo "  Please fix the failures above before deploying."
  echo "  Critical: Ensure all environment variables are set in Vercel dashboard."
  echo ""
  exit 1
fi

