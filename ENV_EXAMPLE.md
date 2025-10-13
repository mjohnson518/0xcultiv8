# Environment Variables Template

Copy this to `.env` in your project root and fill in the values.

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/cultiv8

# Redis
REDIS_URL=redis://localhost:6379

# Blockchain RPC Endpoints
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# AI Services
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
OPENAI_API_KEY=sk-YOUR_KEY

# Authentication
AUTH_SECRET=your-super-secret-auth-key-min-32-chars
AUTH_URL=http://localhost:4000

# Smart Contracts (fill after deployment)
CULTIV8_AGENT_ADDRESS=0x...
AGENT_VAULT_ADDRESS=0x...
STRATEGY_EXECUTOR_ADDRESS=0x...

# Agent Wallet (SECURE - use secrets manager in production)
AGENT_PRIVATE_KEY=0x...

# Protocol Addresses - Ethereum Mainnet
AAVE_POOL_ETHEREUM=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
COMPOUND_COMET_ETHEREUM=0xc3d688B66703497DAA19211EEdff47f25384cdc3
USDC_ETHEREUM=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Protocol Addresses - Base Mainnet
AAVE_POOL_BASE=0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
COMPOUND_COMET_BASE=0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf
USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Rate Limiting
RATE_LIMIT_GENERAL=100
RATE_LIMIT_INVESTMENT=10
RATE_LIMIT_WITHDRAWAL=5

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true

# Security
EMERGENCY_PAUSE=false
CIRCUIT_BREAKER_THRESHOLD=3
CIRCUIT_BREAKER_WINDOW_MS=600000

# Feature Flags
ENABLE_EIP7702=true
ENABLE_LANGGRAPH_AGENT=true
ENABLE_MCP_SERVERS=true
```

## Setup Instructions

1. **Start Docker Desktop** (if not already running)

2. **Start Redis:**
   ```bash
   docker-compose up -d redis
   ```

3. **Verify Redis is running:**
   ```bash
   docker-compose ps
   redis-cli ping  # Should return PONG
   ```

4. **Copy environment variables:**
   ```bash
   cp ENV_EXAMPLE.md .env
   # Edit .env with your actual values
   ```

5. **Install dependencies:**
   ```bash
   cd yieldy/apps/web
   npm install
   ```

