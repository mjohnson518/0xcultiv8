# 0xCultiv8

[![License](https://img.shields.io/badge/license-MIT-blue)]()

Autonomous AI-powered DeFi yield optimization agent for Ethereum and Base.

## Overview

0xCultiv8 discovers, analyzes, and executes DeFi investments using AI-driven decision making with on-chain authorization. The platform implements EIP-7702 (temporary code delegation) and EIP-8004 (agent authorization) for trustless automation.

### Key Features

- **AI-Powered Analysis** - LangGraph orchestration with Claude Sonnet 4 and GPT-4 Turbo
- **Multi-Chain Support** - Ethereum and Base networks
- **Protocol Integration** - Aave V3, Compound V3, Morpho Blue, Ethena
- **On-Chain Authorization** - User-controlled spending limits via EIP-8004
- **Security Controls** - Circuit breakers, rate limiting, audit logging, MEV protection
- **API Monetization** - x402 payment protocol with tier-based credits

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 18, TanStack Query, Tailwind CSS)          │
├─────────────────────────────────────────────────────────────┤
│  API Layer (Hono.js, Auth, Rate Limiting, x402 Payments)    │
├─────────────────────────────────────────────────────────────┤
│  LangGraph Agent                                            │
│  ├─ Analyze Market    ─── Claude Sonnet 4                   │
│  ├─ Generate Strategy ─── Claude Sonnet 4                   │
│  ├─ Select Strategy   ─── Heuristic Scoring                 │
│  ├─ Build Plan        ─── GPT-4 Turbo                       │
│  └─ Execute           ─── Transaction Submission            │
├─────────────────────────────────────────────────────────────┤
│  MCP Servers (DeFi Oracle, Gas Optimizer, Portfolio)        │
├─────────────────────────────────────────────────────────────┤
│  Smart Contracts (EIP-8004 Agent, EIP-7702 Vault)           │
├─────────────────────────────────────────────────────────────┤
│  Protocol Adapters (Aave V3, Compound V3, Morpho, Ethena)   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, React Router 7, TanStack Query, Tailwind CSS |
| Backend | Hono.js, Node.js 20+, PostgreSQL (Neon), Redis |
| AI | LangGraph, Claude Sonnet 4, GPT-4 Turbo, MCP |
| Contracts | Solidity 0.8.20, OpenZeppelin, Hardhat |
| Infrastructure | Docker, Terraform, GitHub Actions |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Redis instance

### Installation

```bash
git clone https://github.com/mjohnson518/0xcultiv8.git
cd 0xcultiv8/yieldy/apps/web
npm install
cp .env.example .env
npm run dev
```

### Environment Variables

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ETHEREUM_RPC_URL=https://...
BASE_RPC_URL=https://...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
AUTH_SECRET=...  # min 32 characters

# x402 Payment Protocol (optional - enables API monetization)
X402_ENABLED=true
X402_PAYMENT_RECEIVER=0x...  # Your USDC address on Base
X402_NETWORK=eip155:8453     # Base mainnet
```

## Project Structure

```
0xcultiv8/
├── contracts/                    # Solidity smart contracts
│   ├── Cultiv8Agent.sol          # EIP-8004 agent authorization
│   ├── AgentVault.sol            # EIP-7702 vault
│   └── interfaces/               # Contract interfaces
├── docs/                         # Documentation
│   ├── SECURITY-MODEL.md
│   └── RUNBOOK.md
├── yieldy/apps/web/              # Web application
│   ├── src/app/api/
│   │   ├── agent/                # LangGraph agent, MCP servers
│   │   ├── protocols/            # DeFi protocol adapters
│   │   ├── execute/              # Transaction execution
│   │   └── middleware/           # Auth, rate limiting, security
│   └── src/components/           # React components
├── infrastructure/               # Docker, Terraform
└── .github/workflows/            # CI/CD pipelines
```

## API Endpoints

| Endpoint | Method | Description | Price |
|----------|--------|-------------|-------|
| `/api/health` | GET | System health check | Free |
| `/api/auth/nonce` | GET | Get authentication nonce | Free |
| `/api/auth/token` | POST | Exchange signature for JWT | Free |
| `/api/agent/run` | POST | Execute agent | $1.00 |
| `/api/agent/scan` | POST | Scan opportunities | $0.15 |
| `/api/credits` | GET | Get user credit balance | Free |
| `/api/credits/packs` | GET/POST | List/purchase credit packs | Free/Varies |
| `/api/execute/preview` | POST | Preview transaction | Free |
| `/api/execute/submit` | POST | Submit transaction | 0.10% fee |
| `/api/authorization` | GET | Get user authorization status | Free |
| `/api/emergency/pause` | POST | Emergency pause (admin) | Free |

*Pricing applies when x402 is enabled. Tier users receive free monthly credits.*

## Security

See [`docs/SECURITY-MODEL.md`](docs/SECURITY-MODEL.md) for details.

- **Authentication** - EIP-191 wallet signatures with JWT
- **Authorization** - EIP-8004 on-chain spending limits
- **Key Management** - AWS KMS / HashiCorp Vault (required in production)
- **MEV Protection** - Flashbots Protect integration
- **Rate Limiting** - Tiered limits by endpoint
- **Circuit Breaker** - Automatic pause on failures

## Payments (x402)

The platform uses [x402](https://x402.org) for HTTP-native payments on Base (USDC).

### Tier Credits (Monthly)

| Tier | Agent Run | Agent Scan | Payment Discount |
|------|-----------|------------|------------------|
| Community | 5 | 20 | 0% |
| Pro | 50 | 200 | 10% |
| Institutional | 200 | 750 | 20% |
| Enterprise | Unlimited | Unlimited | 30% |

### Credit Packs

| Pack | Credits | Price | Savings |
|------|---------|-------|---------|
| Starter | 10 runs | $9 | 10% |
| Growth | 50 runs | $40 | 20% |
| Power | 100 runs | $70 | 30% |

### Execution Fees

- **0.10%** of transaction value (capped at $25)
- Covers MEV protection and gas optimization
- Waived for Enterprise tier

### How It Works

1. **Authenticated users** with remaining credits get free access
2. **Users without credits** receive a `402 Payment Required` response
3. **Pay with USDC** on Base via the `X-PAYMENT` header
4. **Tier discounts** apply to per-request payments
5. **Credit packs** offer volume discounts for frequent users

## Development

```bash
npm test                  # Run tests
npx hardhat test          # Contract tests
npm run build             # Production build
```

## Deployment

```bash
# Staging
docker-compose -f infrastructure/docker/docker-compose.staging.yml up -d

# Via GitHub Actions
gh workflow run deploy-staging.yml
```

See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for operational procedures.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

This software is for educational and research purposes. DeFi investments carry significant risk. Users should understand the risks and never invest more than they can afford to lose. The developers are not responsible for any financial losses.
