#!/bin/bash
# =============================================================================
# 0xCultiv8 Security Analysis Script
# Runs Slither and Mythril static analysis on smart contracts
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output directory
OUTPUT_DIR="security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  0xCultiv8 Security Analysis${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# -----------------------------------------------------------------------------
# Check Dependencies
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Checking dependencies...${NC}"

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed${NC}"
        echo "Install with: $2"
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} $1 found"
}

check_command "slither" "pip install slither-analyzer"
check_command "myth" "pip install mythril"
check_command "npx" "npm install -g npx"

echo ""

# -----------------------------------------------------------------------------
# Compile Contracts
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Compiling contracts...${NC}"
npx hardhat compile --force
echo -e "${GREEN}✓ Contracts compiled${NC}"
echo ""

# -----------------------------------------------------------------------------
# Run Slither
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Running Slither static analysis...${NC}"
echo ""

SLITHER_OUTPUT="$OUTPUT_DIR/slither-report-$TIMESTAMP.json"
SLITHER_SARIF="$OUTPUT_DIR/slither-report-$TIMESTAMP.sarif"

slither . \
    --config-file slither.config.json \
    --json "$SLITHER_OUTPUT" \
    --sarif "$SLITHER_SARIF" \
    2>&1 | tee "$OUTPUT_DIR/slither-console-$TIMESTAMP.txt" || true

echo ""
echo -e "${GREEN}✓ Slither analysis complete${NC}"
echo -e "  Report: $SLITHER_OUTPUT"
echo ""

# Parse Slither results
if [ -f "$SLITHER_OUTPUT" ]; then
    HIGH=$(jq '[.results.detectors[] | select(.impact == "High")] | length' "$SLITHER_OUTPUT" 2>/dev/null || echo "0")
    MEDIUM=$(jq '[.results.detectors[] | select(.impact == "Medium")] | length' "$SLITHER_OUTPUT" 2>/dev/null || echo "0")
    LOW=$(jq '[.results.detectors[] | select(.impact == "Low")] | length' "$SLITHER_OUTPUT" 2>/dev/null || echo "0")
    INFO=$(jq '[.results.detectors[] | select(.impact == "Informational")] | length' "$SLITHER_OUTPUT" 2>/dev/null || echo "0")

    echo -e "  ${RED}High:${NC} $HIGH"
    echo -e "  ${YELLOW}Medium:${NC} $MEDIUM"
    echo -e "  ${BLUE}Low:${NC} $LOW"
    echo -e "  Informational: $INFO"
    echo ""
fi

# -----------------------------------------------------------------------------
# Run Mythril
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Running Mythril symbolic execution...${NC}"
echo ""

MYTHRIL_OUTPUT="$OUTPUT_DIR/mythril-report-$TIMESTAMP.json"

# Analyze main contracts
CONTRACTS=(
    "contracts/Cultiv8Agent.sol"
    "contracts/AgentVault.sol"
)

for CONTRACT in "${CONTRACTS[@]}"; do
    if [ -f "$CONTRACT" ]; then
        echo -e "  Analyzing: $CONTRACT"
        CONTRACT_NAME=$(basename "$CONTRACT" .sol)

        myth analyze "$CONTRACT" \
            --solv 0.8.20 \
            --execution-timeout 300 \
            --max-depth 50 \
            -o json \
            > "$OUTPUT_DIR/mythril-$CONTRACT_NAME-$TIMESTAMP.json" 2>&1 || true

        echo -e "  ${GREEN}✓${NC} $CONTRACT_NAME analyzed"
    fi
done

echo ""
echo -e "${GREEN}✓ Mythril analysis complete${NC}"
echo ""

# -----------------------------------------------------------------------------
# Generate Summary Report
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Generating summary report...${NC}"

SUMMARY_FILE="$OUTPUT_DIR/security-summary-$TIMESTAMP.md"

cat > "$SUMMARY_FILE" << EOF
# 0xCultiv8 Security Analysis Report

**Generated:** $(date)
**Commit:** $(git rev-parse --short HEAD 2>/dev/null || echo "N/A")

## Summary

### Slither Results
- **High Severity:** $HIGH
- **Medium Severity:** $MEDIUM
- **Low Severity:** $LOW
- **Informational:** $INFO

### Mythril Results
See individual contract reports in \`$OUTPUT_DIR/\`

## Contracts Analyzed
EOF

for CONTRACT in "${CONTRACTS[@]}"; do
    if [ -f "$CONTRACT" ]; then
        echo "- $CONTRACT" >> "$SUMMARY_FILE"
    fi
done

cat >> "$SUMMARY_FILE" << EOF

## High Severity Findings

EOF

# Extract high severity findings
if [ -f "$SLITHER_OUTPUT" ]; then
    jq -r '.results.detectors[] | select(.impact == "High") | "### " + .check + "\n\n**Description:** " + .description + "\n\n**Location:** " + (.elements[0].source_mapping.filename_relative // "Unknown") + "\n\n---\n"' "$SLITHER_OUTPUT" >> "$SUMMARY_FILE" 2>/dev/null || true
fi

cat >> "$SUMMARY_FILE" << EOF

## Recommendations

1. Address all high severity findings before deployment
2. Review medium severity findings and prioritize fixes
3. Consider low severity findings during code review
4. Schedule formal audit with security firm

## Files Generated

- \`$SLITHER_OUTPUT\` - Slither JSON report
- \`$SLITHER_SARIF\` - Slither SARIF report (for GitHub)
- \`mythril-*.json\` - Mythril analysis for each contract
- \`$SUMMARY_FILE\` - This summary

EOF

echo -e "${GREEN}✓ Summary report generated: $SUMMARY_FILE${NC}"
echo ""

# -----------------------------------------------------------------------------
# Final Summary
# -----------------------------------------------------------------------------
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Analysis Complete${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Reports saved to: ${GREEN}$OUTPUT_DIR/${NC}"
echo ""

if [ "$HIGH" -gt 0 ]; then
    echo -e "${RED}⚠️  $HIGH high severity issue(s) found!${NC}"
    echo -e "${RED}   Review and fix before deployment.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ No high severity issues found${NC}"
fi

if [ "$MEDIUM" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $MEDIUM medium severity issue(s) found${NC}"
    echo -e "${YELLOW}   Review recommended before deployment.${NC}"
fi

echo ""
