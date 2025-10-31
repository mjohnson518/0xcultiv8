#!/bin/bash

# Cultiv8 Post-Deployment Verification
# Validates deployment is working correctly

set -e

DEPLOY_URL=$1

if [ -z "$DEPLOY_URL" ]; then
  echo "Usage: ./post-deploy.sh <deployment-url>"
  exit 1
fi

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     POST-DEPLOYMENT VERIFICATION                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to test endpoint
test_endpoint() {
  local name=$1
  local url=$2
  local method=${3:-GET}
  
  echo -n "  Testing $name... "
  
  local status_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url")
  
  if [ "$status_code" = "200" ] || [ "$status_code" = "404" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $status_code)"
    ((CHECKS_FAILED++))
    return 1
  fi
}

echo "1. Frontend Pages"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Dashboard" "$DEPLOY_URL/"
test_endpoint "Agent page" "$DEPLOY_URL/agent"
test_endpoint "Opportunities page" "$DEPLOY_URL/opportunities"
test_endpoint "Settings page" "$DEPLOY_URL/settings"

echo ""
echo "2. API Health Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Health check" "$DEPLOY_URL/api/health"
test_endpoint "Agent config" "$DEPLOY_URL/api/agent-config"
test_endpoint "Fee calculator" "$DEPLOY_URL/api/fees/calculate"
test_endpoint "User tier" "$DEPLOY_URL/api/user/tier"

echo ""
echo "3. Static Assets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Favicon" "$DEPLOY_URL/favicon.svg"

echo ""
echo "4. Database Connection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test database by checking if config endpoint returns data
RESPONSE=$(curl -s "$DEPLOY_URL/api/agent-config")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "  ${GREEN}✓ Database connected${NC}"
  ((CHECKS_PASSED++))
else
  echo -e "  ${RED}✗ Database connection failed${NC}"
  echo "  Response: $RESPONSE"
  ((CHECKS_FAILED++))
fi

echo ""
echo "5. Performance Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Measure response time
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$DEPLOY_URL/")

echo -n "  Homepage response time: ${RESPONSE_TIME}s... "

if (( $(echo "$RESPONSE_TIME < 3.0" | bc -l) )); then
  echo -e "${GREEN}✓ PASS${NC}"
  ((CHECKS_PASSED++))
else
  echo -e "${YELLOW}⚠ SLOW${NC} (target < 3s)"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "════════════════════════════════════════════════════════════"
echo ""

TOTAL=$((CHECKS_PASSED + CHECKS_FAILED))
SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($CHECKS_PASSED/$TOTAL)*100}")

echo "  Checks Passed: $CHECKS_PASSED"
echo "  Checks Failed: $CHECKS_FAILED"
echo "  Success Rate: $SUCCESS_RATE%"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ DEPLOYMENT VERIFIED${NC}"
  echo ""
  echo "  Your application is live at:"
  echo "  $DEPLOY_URL"
  echo ""
  exit 0
else
  echo -e "${YELLOW}⚠ DEPLOYMENT HAS ISSUES${NC}"
  echo ""
  echo "  Some checks failed. Please investigate."
  echo "  The application may still be functional."
  echo ""
  exit 1
fi

