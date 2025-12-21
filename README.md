# 0xCultiv8

[![EIP-7702](https://img.shields.io/badge/EIP--7702-Compliant-blue)](https://eips.ethereum.org/EIPS/eip-7702)
[![EIP-8004](https://img.shields.io/badge/EIP--8004-Compliant-green)](https://eips.ethereum.org/EIPS/eip-8004)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

Autonomous AI-powered DeFi investment agent for Ethereum and Base.

## Overview

0xCultiv8 discovers, analyzes, and executes DeFi investments using AI-driven decision making with on-chain authorization. The platform implements EIP-7702 (temporary code delegation) and EIP-8004 (agent authorization) for trustless automation without requiring smart contract wallet deployment.

### Key Capabilities

- **AI-Powered Analysis** - LangGraph orchestration with Claude and GPT-4 for multi-step reasoning
- **Multi-Chain** - Ethereum and Base with live Aave V3 and Compound V3 integration
- **Risk Management** - Four-factor scoring (protocol, financial, technical, market)
- **MEV Protection** - Flashbots integration for protected transaction submission
- **Institutional Security** - Circuit breakers, rate limiting, audit logging, emergency controls

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 19, TanStack Query, Tailwind)              │
├─────────────────────────────────────────────────────────────┤
│  API Layer (Hono.js, Auth, Rate Limiting, Validation)       │
├─────────────────────────────────────────────────────────────┤
│  LangGraph Agent                                            │
│  ├─ Analyze Market    ─── Claude Sonnet 4                   │
│  ├─ Generate Strategy ─── Claude Sonnet 4                   │
│  ├─ Select & Plan     ─── GPT-4 Turbo                       │
│  └─ Execute           ─── Transaction Submission            │
├─────────────────────────────────────────────────────────────┤
│  MCP Servers (DeFi Oracle, Gas Tracker, Portfolio)          │
├─────────────────────────────────────────────────────────────┤
│  Smart Contracts (EIP-8004 Agent, EIP-7702 Vault)           │
├─────────────────────────────────────────────────────────────┤
│  Protocol Adapters (Aave V3, Compound V3)                   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, React Router 7, TanStack Query, Tailwind CSS |
| Backend | Hono.js, Node.js 20, PostgreSQL (Neon), Redis |
| AI | LangGraph, Claude Sonnet 4, GPT-4 Turbo, MCP |
| Contracts | Solidity 0.8.20, OpenZeppelin, Hardhat |
| Security | Zod, JWT, Rate Limiting, Circuit Breaker, Audit Logging |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Redis (for caching/rate limiting)

### Installation

```bash
git clone https://github.com/mjohnson518/0xcultiv8.git
cd 0xcultiv8

# Install dependencies
cd yieldy/apps/web
npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Run development server
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
SESSION_SECRET=...
```

## Project Structure

```
0xcultiv8/
├── contracts/                    # Smart contracts
│   ├── Cultiv8Agent.sol          # EIP-8004 agent authorization
│   ├── AgentVault.sol            # EIP-7702 compatible vault
│   └── test/                     # Contract tests
├── docs/                         # Documentation
│   ├── SECURITY-MODEL.md
│   ├── EIP-7702-INTEGRATION.md
│   └── RUNBOOK.md
├── yieldy/apps/web/              # Web application
│   ├── src/app/api/
│   │   ├── agent/                # LangGraph agent, MCP servers
│   │   ├── protocols/            # DeFi protocol adapters
│   │   ├── execute/              # Transaction execution
│   │   └── utils/                # Risk engine, circuit breaker
│   └── src/components/           # React components
├── infrastructure/               # Docker, Prometheus, Grafana
└── .github/workflows/            # CI/CD pipelines
```

## API Reference

Full API documentation available at [`/docs/openapi.yaml`](yieldy/apps/web/docs/openapi.yaml).

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/auth/nonce` | GET | Get authentication nonce |
| `/api/auth/token` | POST | Exchange signature for JWT |
| `/api/agent/run` | POST | Start agent execution |
| `/api/agent/scan` | POST | Scan for opportunities |
| `/api/execute/preview` | POST | Preview transaction |
| `/api/execute/submit` | POST | Submit transaction |
| `/api/emergency/pause` | POST | Emergency pause (admin) |

## Security

See [`docs/SECURITY-MODEL.md`](docs/SECURITY-MODEL.md) for the complete security architecture.

### Security Features

- **Authentication** - EIP-191 wallet signatures with JWT tokens
- **Authorization** - EIP-8004 on-chain spending limits
- **MEV Protection** - Flashbots Protect RPC integration
- **Circuit Breaker** - Automatic pause on repeated failures
- **Rate Limiting** - Tiered limits by endpoint sensitivity
- **Audit Logging** - Complete operation trail
- **Secrets Management** - AWS KMS / HashiCorp Vault support

## Development

```bash
# Run tests
npm test

# Run contract tests
npx hardhat test

# Security analysis
./scripts/security-analysis.sh

# Build for production
npm run build
```

## Deployment

Docker-based deployment with staging environment:

```bash
# Staging
docker-compose -f infrastructure/docker/docker-compose.staging.yml up -d

# Or via GitHub Actions
gh workflow run deploy-staging.yml
```

See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for operational procedures.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with clear commit messages
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

This software is for educational and research purposes. DeFi investments carry significant risk. Users should understand the risks, never invest more than they can afford to lose, and consult financial advisors before making investment decisions. The developers are not responsible for any financial losses.

