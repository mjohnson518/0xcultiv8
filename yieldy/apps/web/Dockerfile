# ============================================================================
# 0xCultiv8 Web Application Dockerfile
# Multi-stage build for optimized production images
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Install dependencies required for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --legacy-peer-deps --omit=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies required for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files and install ALL dependencies (including dev)
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build arguments
ARG NODE_ENV=production
ARG VERSION=latest

ENV NODE_ENV=${NODE_ENV}
ENV VERSION=${VERSION}

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Runner
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 cultiv8

# Copy built application
COPY --from=builder --chown=cultiv8:nodejs /app/build ./build
COPY --from=builder --chown=cultiv8:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=cultiv8:nodejs /app/package.json ./package.json
COPY --from=builder --chown=cultiv8:nodejs /app/server-start.js ./server-start.js

# Copy migrations (for database setup)
COPY --from=builder --chown=cultiv8:nodejs /app/migrations ./migrations

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown cultiv8:nodejs /app/logs

# Install curl for health checks
RUN apk add --no-cache curl

# Switch to non-root user
USER cultiv8

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start the application using custom server-start.js
CMD ["node", "./server-start.js"]
