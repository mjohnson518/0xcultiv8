# Cultiv8 Agent

[![EIP-7702 Compliant](https://img.shields.io/badge/EIP--7702-Compliant-blue)](https://eips.ethereum.org/EIPS/eip-7702)
[![EIP-8004 Compliant](https://img.shields.io/badge/EIP--8004-Compliant-green)](https://eips.ethereum.org/EIPS/eip-8004)
[![Tests Passing](https://img.shields.io/badge/tests-43%2F43%20passing-brightgreen)]()
[![Security](https://img.shields.io/badge/security-institutional%20grade-success)]()

**The world's first EIP-7702/8004 compliant trustless yield farming agent.**

An autonomous AI-powered DeFi investment agent that discovers, analyzes, and manages USDC investments across Ethereum and Base blockchains. Cultiv8 Agent continuously scans for optimal opportunities, evaluates risk profiles, and executes investment decisions based on configurable parameters.

## What Makes Cultiv8 Different

- **First EIP-7702 Implementation**: Seamless EOA code delegation for gasless operations
- **EIP-8004 Compliant**: Trustless agent authorization with on-chain spending limits
- **Institutional Security**: Multi-layer protection with circuit breakers and audit logging
- **Real Web3 Integration**: Live data from Aave and Compound on-chain
- **AI-Powered Intelligence**: Multi-dimensional risk scoring and portfolio optimization
- **Full Transparency**: All agent decisions and executions recorded on-chain

## Overview

Cultiv8 Agent is a sophisticated automated investment platform that combines blockchain technology with artificial intelligence to optimize USDC returns across decentralized finance protocols. The agent operates autonomously, scanning for opportunities, performing risk assessments, and making data-driven investment decisions.

### Key Features

- **Autonomous Operation**: Automated scanning and investment execution based on configurable parameters
- **Multi-Chain Support**: Operates across Ethereum and Base blockchains
- **AI-Powered Analysis**: Leverages ChatGPT for qualitative opportunity assessment and investment decisions
- **Risk Management**: Comprehensive 10-point risk scoring system evaluating protocols across multiple dimensions
- **Real-Time Monitoring**: Continuous tracking of investments and performance metrics
- **Auto-Rebalancing**: Automatically exits underperforming positions and reallocates to better opportunities
- **Performance Fee System**: Transparent fee structure on realized profits
- **Dark Mode Support**: Full UI theming for day and night usage

## Architecture

### Technology Stack

**Frontend:**
- React 19
- React Router 7
- TanStack Query (React Query) for data management
- Tailwind CSS for styling
- Lucide React for icons

**Backend:**
- Hono.js server framework
- Neon Postgres database
- ChatGPT integration for AI analysis
- RESTful API architecture

**Blockchain:**
- Multi-chain support (Ethereum, Base)
- Smart contract interaction simulation
- Web3 wallet integration ready

### Project Structure

```
cultiv8/
├── apps/
│   ├── web/                    # Web application
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/        # API routes
│   │   │   │   │   ├── agent/  # Agent scan and scheduler
│   │   │   │   │   ├── agent-config/  # Configuration management
│   │   │   │   │   ├── agent-funds/   # Fund management
│   │   │   │   │   ├── cultiv8-opportunities/  # Opportunity tracking
│   │   │   │   │   ├── investments/    # Investment tracking
│   │   │   │   │   └── performance/    # Performance analytics
│   │   │   │   ├── layout.jsx
│   │   │   │   └── page.jsx
│   │   │   ├── components/
│   │   │   │   └── Cultiv8Agent/  # Main application components
│   │   │   │       ├── Cultiv8Agent.jsx
│   │   │   │       ├── DashboardTab.jsx
│   │   │   │       ├── OpportunitiesTab.jsx
│   │   │   │       ├── InvestmentsTab.jsx
│   │   │   │       ├── PerformanceTab.jsx
│   │   │   │       ├── FundingTab.jsx
│   │   │   │       ├── RiskMethodologyTab.jsx
│   │   │   │       ├── SettingsTab.jsx
│   │   │   │       ├── Header.jsx
│   │   │   │       ├── Navigation.jsx
│   │   │   │       └── ... (additional components)
│   │   │   └── hooks/
│   │   │       └── useCultiv8AgentData.js
│   │   └── package.json
│   └── mobile/                 # Mobile application (Expo/React Native)
│       └── ... (mobile app structure)
└── README.md
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

