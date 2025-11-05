# Cultiv8 MCP Servers

Model Context Protocol (MCP) servers for the Cultiv8 autonomous yield farming agent.

## Overview

This directory contains **three specialized MCP servers** that provide DeFi intelligence tools for LLMs:

1. **DeFi Oracle Server** - Yield opportunity discovery and protocol monitoring
2. **Gas Optimizer Server** - Transaction optimization with MEV protection
3. **Portfolio Management Server** - Rebalancing and performance tracking

## Quick Start

### Running Servers

```bash
# DeFi Oracle Server (Enhanced v2.1)
node defi-oracle-server-enhanced.js

# Gas Optimizer Server (v2.0 - Fixed)
node gas-optimizer-server-refined.js

# Portfolio Management Server (v2.0)
node portfolio-server-refined.js
```

### Environment Setup

Create `.env` file with required variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# RPC Endpoints
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# MEV Protection (optional)
FLASHBOTS_RPC_URL=https://rpc.flashbots.net
EDEN_RPC_URL=https://api.edennetwork.io/v1/rpc

# Optional: Override defaults
MCP_CHARACTER_LIMIT=25000
MIN_APY=5.0
MAX_RISK=7.0
LOG_LEVEL=info
```

## Server Versions

### DeFi Oracle Server

| File | Version | Status | Features |
|------|---------|--------|----------|
| `defi-oracle-server.js` | 1.0.0 | Basic | 4 basic tools |
| `defi-oracle-server-refined.js` | 2.0.0 | Production | 4 workflow tools |
| `defi-oracle-server-enhanced.js` | 2.1.0 | **Recommended** | Tools + Resources + Prompts |

**Recommendation:** Use **v2.1.0 (Enhanced)** for new implementations.

### Gas Optimizer Server

| File | Version | Status | Features |
|------|---------|--------|----------|
| `gas-tracker-server.js` | 1.0.0 | Basic | 3 basic tools |
| `gas-optimizer-server-refined.js` | 2.0.0 | **Recommended** | 3 workflow tools + MEV |

### Portfolio Management Server

| File | Version | Status | Features |
|------|---------|--------|----------|
| `portfolio-tracker-server.js` | 1.0.0 | Basic | 3 basic tools |
| `portfolio-server-refined.js` | 2.0.0 | **Recommended** | 4 workflow tools + MPT |

## Configuration

All servers use `config.js` for centralized configuration:

```javascript
import MCP_CONFIG from './config.js';

// Access configuration
MCP_CONFIG.CHARACTER_LIMIT
MCP_CONFIG.RISK_WEIGHTS
MCP_CONFIG.GAS_ESTIMATES
MCP_CONFIG.PROTOCOLS
```

See `config.js` for full configuration options and environment variable overrides.

## MCP Capabilities

### Tools

All servers expose **workflow-oriented tools** (not just API wrappers):

**DeFi Oracle (4 tools):**
- `discover_yield_opportunities` - PRIMARY yield discovery with ranking
- `monitor_protocol_health` - Protocol health monitoring with alerts
- `analyze_protocol_risk` - Multi-dimensional risk assessment
- `analyze_market_conditions` - Strategic market intelligence

**Gas Optimizer (3 tools):**
- `optimize_transaction` - PRIMARY optimization workflow
- `analyze_gas_trends` - Gas price trend analysis and forecasting
- `assess_mev_risk` - MEV risk assessment and protection

**Portfolio Management (4 tools):**
- `analyze_rebalancing_opportunities` - PRIMARY rebalancing workflow
- `track_portfolio_performance` - Comprehensive performance tracking
- `analyze_portfolio_risk` - Portfolio-level risk analysis
- `calculate_optimal_position_size` - Kelly Criterion position sizing

### Resources (Enhanced v2.1 only)

Resources expose data for direct LLM access:

```
defi://protocols/list              - All supported protocols
defi://opportunities/latest        - Latest yield opportunities
defi://config/risk-weights         - Risk assessment config
defi://markets/summary             - Market conditions
defi://protocols/aave-v3           - Aave V3 data
defi://protocols/compound-v3       - Compound V3 data
```

**Usage:**
```javascript
// LLM reads resource directly (no tool call needed)
const protocols = await mcp.readResource("defi://protocols/list");
```

### Prompts (Enhanced v2.1 only)

Reusable workflow templates:

- `quick_yield_scan` - Fast yield discovery by risk profile
- `comprehensive_analysis` - Full market analysis workflow
- `risk_assessment` - Detailed protocol risk assessment
- `market_timing` - Market timing analysis

**Usage:**
```javascript
// Get prompt template
const prompt = await mcp.getPrompt("quick_yield_scan", {
  chain: "ethereum",
  risk_profile: "moderate"
});
// Execute prompt workflow
```

## Tool Examples

### Discover Yield Opportunities

```javascript
const result = await mcp.callTool("discover_yield_opportunities", {
  chain: "ethereum",
  min_apy: 8.0,
  max_risk: 6,
  min_tvl: 5000000,
  response_format: "concise",
  limit: 5
});

// Returns ranked opportunities with Sharpe ratios
```

### Optimize Transaction

```javascript
const result = await mcp.callTool("optimize_transaction", {
  chain: "base",
  transaction_type: "deposit",
  amount_usd: 10000,
  urgency: "normal"
});

// Returns:
// - Optimal gas settings
// - MEV protection recommendations
// - Timing suggestions
// - Cost-benefit analysis
```

### Analyze Rebalancing

```javascript
const result = await mcp.callTool("analyze_rebalancing_opportunities", {
  target_risk: 7,
  rebalance_threshold: 5,
  include_new_opportunities: true,
  max_gas_cost_percent: 0.5
});

// Returns:
// - Current vs optimal allocation
// - Specific rebalancing steps
// - Cost-benefit analysis
// - Payback period
```

## Architecture

```
┌─────────────────────────────────────────┐
│          LLM / Agent                    │
│  (Claude, GPT-4, LangGraph)            │
└────────────┬────────────────────────────┘
             │ MCP Protocol
             │ (stdio transport)
             │
┌────────────┴────────────────────────────┐
│     MCP Servers (this directory)        │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │  DeFi Oracle Server v2.1         │   │
│  │  - Tools (4)                     │   │
│  │  - Resources (6)                 │   │
│  │  - Prompts (4)                   │   │
│  └──────────────┬───────────────────┘   │
│                 │                        │
│  ┌──────────────┴───────────────────┐   │
│  │  Gas Optimizer Server v2.0       │   │
│  │  - Tools (3)                     │   │
│  └──────────────┬───────────────────┘   │
│                 │                        │
│  ┌──────────────┴───────────────────┐   │
│  │  Portfolio Management Server 2.0 │   │
│  │  - Tools (4)                     │   │
│  └──────────────┬───────────────────┘   │
└─────────────────┼───────────────────────┘
                  │
     ┌────────────┴────────────────┐
     │                             │
┌────┴─────┐              ┌────────┴────────┐
│ Database │              │ RPC Providers   │
│ (Postgres)│             │ (Alchemy, etc.) │
└──────────┘              └─────────────────┘
```

## Error Handling

All servers use structured error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "suggestion": "Try this instead",
  "requestId": "uuid",
  "timestamp": "2025-11-05T10:30:00.000Z"
}
```

**Error Codes:**
- `UNKNOWN_TOOL` - Tool name not recognized
- `UNKNOWN_RESOURCE` - Resource URI not recognized
- `UNKNOWN_PROMPT` - Prompt name not recognized
- `INVALID_PARAMS` - Invalid tool parameters
- `DATABASE_ERROR` - Database query failed
- `RPC_ERROR` - RPC provider error
- `INTERNAL_ERROR` - Unexpected server error

## Performance

### Benchmarks (v2.1 Enhanced)

| Operation | v2.0 | v2.1 | Improvement |
|-----------|------|------|-------------|
| Tool Call (uncached) | 500-1000ms | 500-1000ms | - |
| Tool Call (cached) | N/A | <50ms | **10-20x faster** |
| Resource Read | N/A | <100ms | **New feature** |
| Protocol List | 500ms (tool) | 50ms (resource) | **10x faster** |

### Caching

v2.1 Enhanced includes in-memory LRU caching:

- **Protocol data:** 5 minutes TTL
- **Gas prices:** 30 seconds TTL
- **Portfolio data:** 2 minutes TTL
- **Market conditions:** 5 minutes TTL

Expected cache hit rate: ~60%

## Testing

### Manual Testing

```bash
# Test server startup
node defi-oracle-server-enhanced.js
# Should output: ✅ DeFi Oracle MCP Server v2.1.0 (Enhanced) running

# Test with MCP Inspector
mcp-inspector --server defi-oracle-server-enhanced.js
```

### Integration Tests

```bash
# Run test suite
npm run test

# Run specific MCP tests
npm run test test/mcp-servers.test.js
```

### Health Checks

Check if servers are responsive:

```bash
# List tools
mcp tools list

# List resources (v2.1 only)
mcp resources list

# List prompts (v2.1 only)
mcp prompts list
```

## Monitoring

### Logs

All servers use structured JSON logging:

```json
{
  "level": "info",
  "message": "[MCP Tool Call]",
  "requestId": "a1b2c3d4-...",
  "tool": "discover_yield_opportunities",
  "duration_ms": 342
}
```

**Log Levels:**
- `debug` - Detailed debugging info
- `info` - Normal operations
- `warn` - Warning conditions
- `error` - Error conditions

**Set log level:**
```bash
LOG_LEVEL=debug node defi-oracle-server-enhanced.js
```

### Metrics

Track these metrics for monitoring:

- **Tool calls:** Count by tool name
- **Tool duration:** Average, P95, P99
- **Tool errors:** Count by error code
- **Cache hit rate:** Percentage
- **Resource reads:** Count by URI

## Troubleshooting

### Server won't start

**Check:**
1. Environment variables set correctly
2. Database connection working
3. RPC endpoints accessible
4. Node version >= 20.0.0

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Test RPC endpoints
curl $ETHEREUM_RPC_URL -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Tool calls failing

**Check logs:**
```bash
# Enable debug logging
LOG_LEVEL=debug node defi-oracle-server-enhanced.js

# Check error details in logs
```

**Common issues:**
- Invalid parameters (check tool schema)
- Database timeout (increase timeout in config)
- RPC provider rate limiting (check rate limits)

### Poor performance

**Optimization steps:**
1. Enable caching (v2.1): `ENABLE_MCP_CACHE=true`
2. Increase cache TTL: `CACHE_TTL_PROTOCOL=600000` (10 min)
3. Add database indexes (see migrations)
4. Use faster RPC provider
5. Enable connection pooling

## Security

### Best Practices

✅ **Do:**
- Validate all tool inputs (automatic via JSON Schema)
- Sanitize user addresses in logs
- Use environment variables for secrets
- Enable request ID tracking
- Monitor error rates

❌ **Don't:**
- Log sensitive data (private keys, full addresses)
- Expose internal error details in production
- Skip input validation
- Hard-code secrets
- Disable HTTPS for RPC endpoints

### Input Validation

All tools use JSON Schema validation:

```javascript
// Automatically validated
{
  chain: { type: "string", enum: ["ethereum", "base"] },
  min_apy: { type: "number", minimum: 0, maximum: 100 },
  // Invalid inputs rejected before tool execution
}
```

## Contributing

### Adding New Tools

1. Define tool schema in `ListToolsResultSchema` handler
2. Implement tool method
3. Add to switch statement in `CallToolResultSchema` handler
4. Update documentation

### Adding New Resources

1. Define resource in `ListResourcesResultSchema` handler
2. Implement data fetcher
3. Add to switch statement in `ReadResourceResultSchema` handler
4. Configure caching TTL

### Adding New Prompts

1. Define prompt in `ListPromptsResultSchema` handler
2. Implement prompt template generator
3. Add to switch statement in `GetPromptResultSchema` handler
4. Document prompt parameters

## Documentation

- **Detailed Review:** [../../../../../docs/MCP_REVIEW_AND_RECOMMENDATIONS.md](../../../../../docs/MCP_REVIEW_AND_RECOMMENDATIONS.md)
- **Implementation Summary:** [../../../../../docs/MCP_IMPLEMENTATION_SUMMARY.md](../../../../../docs/MCP_IMPLEMENTATION_SUMMARY.md)
- **MCP Specification:** https://spec.modelcontextprotocol.io/
- **MCP SDK:** https://github.com/modelcontextprotocol/sdk

## Support

For issues or questions:

1. Check logs with `LOG_LEVEL=debug`
2. Review error messages and suggestions
3. Consult documentation
4. Check GitHub issues

## License

Part of the Cultiv8 project.

---

**Version:** 2.1.0
**Last Updated:** 2025-11-05
**Status:** ✅ Production Ready
