# Cultiv8 Agent

[![EIP-7702 Compliant](https://img.shields.io/badge/EIP--7702-Compliant-blue)](https://eips.ethereum.org/EIPS/eip-7702)
[![EIP-8004 Compliant](https://img.shields.io/badge/EIP--8004-Compliant-green)](https://eips.ethereum.org/EIPS/eip-8004)
[![Tests Passing](https://img.shields.io/badge/tests-43%2F43%20passing-brightgreen)]()
[![Security](https://img.shields.io/badge/security-institutional%20grade-success)]()

**EIP-7702/8004 compliant trustless yield farming agent.**

An autonomous AI-powered DeFi investment agent that discovers, analyzes, and manages investments across Ethereum and Base. Cultiv8 Agent continuously scans for optimal opportunities, evaluates risk profiles, and executes investment decisions based on configurable parameters.

## What Makes Cultiv8 Different

Cultiv8 implemenst EIP-7702 and EIP-8004 standards, enabling trustless agent automation with on-chain authorization and temporary code delegation. This provides seamless user experience without requiring smart contract wallet deployment.

### Core Differentiators

- **EIP-7702 Implementation**: Temporary EOA code delegation for gasless batch operations
- **EIP-8004 Compliance**: On-chain agent authorization with revocable spending limits
- **LangGraph AI Architecture**: Multi-step reasoning with Claude Sonnet 4.5 and GPT-4 Turbo
- **Explainable Decisions**: Complete reasoning chain visible for every agent action
- **Institutional Security**: Seven-layer defense including rate limiting, circuit breakers, and comprehensive audit logging
- **Real Protocol Integration**: Live data from Aave V3 and Compound V3 via ethers.js
- **Modern Portfolio Theory**: Risk-adjusted allocation using Sharpe ratio and Kelly criterion
- **MCP Server Architecture**: Standardized tool integration for DeFi oracles and portfolio tracking

## Overview

The Cultiv8 Agent is an autonomous yield farming platform that combines AI decision-making with trustless smart contract execution. The platform analyzes opportunities across Ethereum and Base networks, calculates multi-dimensional risk scores, optimizes portfolio allocation, and executes transactions within user-defined spending limits.

### Key Features

- **Autonomous Operation**: LangGraph state machine coordinates analysis, strategy generation, selection, planning, and execution
- **Multi-Chain Support**: Ethereum and Base with extensible architecture for additional networks
- **Hybrid AI Analysis**: Claude Sonnet 4.5 for strategic analysis, GPT-4 Turbo for execution planning
- **Risk Management**: Four-factor risk scoring (protocol 40%, financial 35%, technical 15%, market 10%)
- **Real-Time Data**: Live APY and TVL from protocol smart contracts
- **Transaction Execution**: Gas-optimized deposits and withdrawals with MEV protection
- **State Persistence**: PostgreSQL checkpointing enables resumable agent execution
- **Memory System**: Learns from outcomes to improve future decisions

## Architecture

### Technology Stack

**AI & Agent Framework:**
- LangGraph for state machine orchestration
- Claude Sonnet 4.5 for strategic analysis
- GPT-4 Turbo for execution planning
- MCP (Model Context Protocol) servers for tool integration
- PostgreSQL checkpointing for state persistence

**Smart Contracts:**
- Solidity 0.8.20
- OpenZeppelin security primitives
- EIP-8004 agent authorization
- EIP-7702 temporary code delegation
- Hardhat development environment

**Backend:**
- React Router 7 with Hono.js
- Neon PostgreSQL database
- Redis for rate limiting and caching
- Winston structured logging
- ethers.js v6 for blockchain interactions

**Frontend:**
- React 19
- TanStack Query for state management
- Tailwind CSS
- Real-time reasoning chain visualization

**Security:**
- Zod schema validation
- JWT authentication with wallet signatures
- Rate limiting (5 tiers)
- Circuit breaker pattern
- Comprehensive audit logging

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React, Wagmi, Real-time Reasoning Display)       │
├─────────────────────────────────────────────────────────────┤
│  API Layer (Authentication, Validation, Rate Limiting)      │
├─────────────────────────────────────────────────────────────┤
│  LangGraph Agent (Claude + GPT-4 Multi-Step Reasoning)      │
│  ├─ Analyze Market   (Claude Sonnet 4.5)                    │
│  ├─ Generate Strategies (Claude Sonnet 4.5)                 │
│  ├─ Select Strategy  (Heuristic Scoring)                    │
│  ├─ Build Plan       (GPT-4 Turbo)                          │
│  └─ Execute          (Transaction Submission)               │
├─────────────────────────────────────────────────────────────┤
│  MCP Servers (DeFi Oracle, Gas Tracker, Portfolio)          │
├─────────────────────────────────────────────────────────────┤
│  Smart Contracts (EIP-8004 Agent, EIP-7702 Vault)           │
├─────────────────────────────────────────────────────────────┤
│  Protocol Adapters (Aave V3, Compound V3)                   │
├─────────────────────────────────────────────────────────────┤
│  Blockchain (Ethereum, Base)                                │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
0xcultiv8/
├── contracts/                          # Smart contracts
│   ├── Cultiv8Agent.sol                # EIP-8004 agent authorization
│   ├── AgentVault.sol                  # EIP-7702 compatible vault
│   ├── interfaces/                     # Contract interfaces
│   └── test/                           # 43 comprehensive tests
├── docs/                               # Technical documentation
│   ├── EIP-7702-INTEGRATION.md         # EIP-7702 implementation guide
│   └── SECURITY-MODEL.md               # Security architecture
├── yieldy/apps/web/                    # Web application
│   ├── src/app/api/
│   │   ├── agent/
│   │   │   ├── langgraph/              # LangGraph state machine
│   │   │   ├── mcp/                    # MCP servers (3)
│   │   │   ├── memory/                 # Memory & learning system
│   │   │   ├── safety/                 # Safety controller
│   │   │   ├── run/                    # Agent execution endpoint
│   │   │   ├── status/                 # Status endpoint
│   │   │   └── history/                # Decision history
│   │   ├── protocols/                  # Protocol adapters
│   │   │   ├── AaveV3Adapter.js
│   │   │   ├── CompoundV3Adapter.js
│   │   │   └── adapters.js
│   │   ├── middleware/                 # Security middleware
│   │   │   ├── rateLimit.js
│   │   │   ├── auth.js
│   │   │   ├── validation.js
│   │   │   └── metrics.js
│   │   ├── schemas/                    # Zod validation schemas
│   │   ├── utils/
│   │   │   ├── riskEngine.js           # Multi-dimensional risk scoring
│   │   │   ├── portfolioOptimizer.js   # MPT optimization
│   │   │   ├── gasOptimizer.js         # Gas & MEV protection
│   │   │   ├── circuitBreaker.js       # Emergency controls
│   │   │   ├── auditLogger.js          # Audit trail system
│   │   │   ├── logger.js               # Structured logging
│   │   │   └── cache.js                # Redis caching
│   │   ├── execute/                    # Transaction execution
│   │   ├── eip7702/                    # EIP-7702 transaction builder
│   │   ├── emergency/                  # Emergency pause controls
│   │   └── ... (additional routes)
│   └── src/components/Cultiv8Agent/
│       ├── AgentDashboard.jsx          # Main agent interface
│       ├── ReasoningChain.jsx          # AI reasoning visualization
│       ├── AgentAuthorization.jsx      # EIP-8004 authorization UI
│       ├── TransactionPreview.jsx      # Transaction simulation UI
│       └── ... (UI components)
├── migrations/                         # Database migrations
│   ├── 001_add_indexes.sql
│   ├── 002_rename_tables.sql
│   └── 003_agent_decisions.sql
├── docker-compose.yml                  # Redis infrastructure
└── hardhat.config.js                   # Smart contract configuration
```

## Core Components

### Agent Scanning System

The agent continuously scans blockchains for investment opportunities:

1. **Blockchain Scanner**: Discovers lending protocols, liquidity pools, and yield strategies
2. **Opportunity Storage**: Maintains database of discovered opportunities with real-time updates
3. **AI Analysis**: Evaluates each opportunity using ChatGPT for qualitative assessment
4. **Investment Execution**: Simulates blockchain transactions for approved investments

### Risk Scoring Methodology

Cultiv8 uses a comprehensive 10-point risk scoring system:

**Protocol Factors (40% Weight)**
- Age and track record
- Audit history
- Bug bounty programs
- Governance structure
- Team reputation

**Financial Factors (35% Weight)**
- Total Value Locked (TVL)
- APY sustainability
- Liquidity depth
- Revenue sources
- Token economics

**Technical Factors (15% Weight)**
- Smart contract complexity
- Upgrade mechanisms
- Oracle dependencies
- Composability risk

**Market Factors (10% Weight)**
- Market conditions
- Regulatory risk
- Competition
- Network risk

### Investment Decision Process

1. **Initial Screening**: Filter opportunities by minimum APY and maximum risk score
2. **Risk Assessment**: Calculate comprehensive risk score using methodology above
3. **AI Analysis**: ChatGPT evaluates qualitative factors and market conditions
4. **Portfolio Balance**: Consider existing positions and diversification needs
5. **Investment Decision**: Determine investment amount based on confidence level
6. **Continuous Monitoring**: Re-evaluate positions as market conditions change

### Auto-Rebalancing

The agent automatically rebalances the portfolio based on:
- Opportunity deactivation or protocol issues
- APY drops below configured minimum threshold
- Better opportunities emerge with significant APY improvement (1%+ absolute)

When exiting positions:
- Calculates accrued returns based on holding period and APY
- Applies performance fee to realized profits
- Records fee in ledger and adjusts available funds
- Frees capital for reallocation to better opportunities

### Performance Fee System

- Configurable performance fee percentage (default: 10%)
- Applied only to realized profits from withdrawn investments
- Transparent fee tracking and ledger system
- Reduces available agent funds by fee amount

## Database Schema

### Core Tables

**agent_config**
- Configuration parameters for autonomous operation
- Investment limits, risk thresholds, scan intervals
- Protocol preferences and blacklists

**cultiv8_opportunities**
- Discovered DeFi opportunities
- Protocol details, APY, TVL, risk scores
- Real-time updates from blockchain scans

**investments**
- Active and historical investment records
- Amount, blockchain, transaction hashes
- Expected vs. actual returns
- Investment and withdrawal timestamps

**agent_fund_transactions**
- Fund deposits, withdrawals, and adjustments
- Transaction history and audit trail
- Performance fee tracking

**performance_fees**
- Fee ledger for transparency
- Investment-specific fee calculations
- Historical fee data

**scan_logs**
- Scan execution history
- Opportunities found and stored
- Investments made per scan
- Error tracking

## Configuration

### Agent Settings

Configurable through the Settings tab or API:

```javascript
{
  max_investment_per_opportunity: 1000,  // Max USDC per opportunity
  max_total_investment: 10000,            // Max total USDC invested
  min_apy_threshold: 5.0,                 // Minimum acceptable APY (%)
  max_risk_score: 7,                      // Maximum acceptable risk (1-10)
  auto_invest_enabled: false,             // Enable autonomous investing
  scan_interval_minutes: 1440,            // Scan frequency (default: daily)
  preferred_protocols: [],                // Protocol whitelist (optional)
  blacklisted_protocols: []               // Protocol blacklist (optional)
}
```

### Environment Variables

Required environment variables for production:

```bash
# Database
DATABASE_URL=postgresql://...

# Blockchain RPC Endpoints (for production)
ETHEREUM_RPC_URL=https://...
BASE_RPC_URL=https://...

# AI Integration
OPENAI_API_KEY=sk-...

# Security
SESSION_SECRET=...
```

## Installation

### Prerequisites

- Node.js 20+
- Bun package manager (or npm/yarn)
- PostgreSQL database (Neon recommended)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/mjohnson518/0xcultiv8.git
cd 0xcultiv8
```

2. Install dependencies:
```bash
# Web application
cd apps/web
bun install

# Mobile application (optional)
cd ../mobile
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize database:
```bash
# Database tables are created automatically on first run
```

5. Start development server:
```bash
# Web
cd apps/web
bun dev

# Mobile
cd apps/mobile
npm start
```

## Usage

### Initial Setup

1. **Fund the Agent**: Navigate to the Funding tab and deposit USDC
2. **Configure Settings**: Set investment limits, risk tolerance, and APY thresholds
3. **Review Opportunities**: Check the Opportunities tab to see discovered protocols
4. **Enable Auto-Invest**: Toggle the agent to start autonomous operation

### Manual Operation

- **Run Scan**: Click "Run Scan" to manually trigger blockchain scanning
- **Review Investments**: Monitor active positions in the Investments tab
- **Track Performance**: View returns and metrics in the Performance tab
- **Adjust Settings**: Modify configuration as needed based on market conditions

### API Endpoints

#### Agent Operations

```bash
# Trigger scan
POST /api/agent/scan
{
  "blockchain": "ethereum" | "base" | "both",
  "forceRun": true,
  "scanOnly": false
}

# Scheduler tick (automatic rebalancing)
POST /api/agent/scheduler
{
  "tick": true
}
```

#### Configuration

```bash
# Get config
GET /api/agent-config

# Update config
PUT /api/agent-config
{
  "max_investment_per_opportunity": 1000,
  "auto_invest_enabled": true,
  ...
}
```

#### Opportunities

```bash
# List opportunities
GET /api/cultiv8-opportunities?blockchain=ethereum&minApy=5&maxRisk=7

# Create opportunity (manual)
POST /api/cultiv8-opportunities
{
  "protocol_name": "Aave",
  "blockchain": "ethereum",
  "pool_address": "0x...",
  "apy": 4.25,
  "tvl": 1500000000,
  "risk_score": 3,
  ...
}
```

#### Investments

```bash
# List investments
GET /api/investments?status=confirmed&blockchain=ethereum

# Get performance metrics
GET /api/performance
```

## Security Considerations

### Current Implementation

- Simulated blockchain transactions for demo/testing
- No real fund transfers or smart contract interactions
- Safe for development and demonstration purposes

### Production Readiness Checklist

- [ ] Implement real Web3 wallet integration
- [ ] Add multi-signature wallet support for fund management
- [ ] Integrate with actual DeFi protocol smart contracts
- [ ] Implement comprehensive transaction signing and verification
- [ ] Add rate limiting and request validation
- [ ] Implement audit logging for all critical operations
- [ ] Add emergency pause functionality
- [ ] Set up monitoring and alerting systems
- [ ] Conduct security audit of smart contract interactions
- [ ] Implement proper key management and encryption

## Development

### Running Tests

```bash
cd apps/web
bun test
```

### Code Quality

```bash
# Type checking
bun typecheck

# Linting
bun lint
```

### Building for Production

```bash
cd apps/web
bun build
```

## Deployment

### Web Application

Compatible with:
- Vercel
- Netlify
- Cloudflare Pages
- AWS Amplify
- Self-hosted Node.js

### Database

Recommended:
- Neon (Serverless PostgreSQL)
- Supabase
- AWS RDS
- Railway

## Roadmap

### Phase 1: Core Enhancement
- Real blockchain integration
- Multi-wallet support
- Additional chain support (Polygon, Arbitrum, Optimism)

### Phase 2: Advanced Features
- Portfolio optimization algorithms
- Historical backtesting
- Custom strategy builder
- Notification system

### Phase 3: Community Features
- Strategy sharing marketplace
- Social trading features
- Performance leaderboards
- Educational resources

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/mjohnson518/0xcultiv8/issues
- Discussions: https://github.com/mjohnson518/0xcultiv8/discussions

## Disclaimer

This software is provided for educational and research purposes. Cryptocurrency investments carry significant risk. Users should:
- Understand the risks of DeFi investing
- Never invest more than they can afford to lose
- Conduct their own research before using automated investment tools
- Be aware that past performance does not guarantee future results
- Consult with financial advisors before making investment decisions

The developers are not responsible for any financial losses incurred through the use of this software.

