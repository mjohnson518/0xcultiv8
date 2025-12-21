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

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 18, TanStack Query, Tailwind CSS)          │
├─────────────────────────────────────────────────────────────┤
│  API Layer (Hono.js, Auth, Rate Limiting, CSRF Protection)  │
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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/auth/nonce` | GET | Get authentication nonce |
| `/api/auth/token` | POST | Exchange signature for JWT |
| `/api/agent/run` | POST | Execute agent |
| `/api/agent/scan` | POST | Scan opportunities |
| `/api/execute/preview` | POST | Preview transaction |
| `/api/execute/submit` | POST | Submit transaction |
| `/api/authorization` | GET | Get user authorization status |
| `/api/emergency/pause` | POST | Emergency pause (admin) |

## Security

See [`docs/SECURITY-MODEL.md`](docs/SECURITY-MODEL.md) for details.

- **Authentication** - EIP-191 wallet signatures with JWT
- **Authorization** - EIP-8004 on-chain spending limits
- **Key Management** - AWS KMS / HashiCorp Vault (required in production)
- **MEV Protection** - Flashbots Protect integration
- **Rate Limiting** - Tiered limits by endpoint
- **Circuit Breaker** - Automatic pause on failures

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
