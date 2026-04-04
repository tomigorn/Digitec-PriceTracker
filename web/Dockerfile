# Multi-stage Dockerfile for Next.js (build then run)
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Install build dependencies (for native modules if needed)
RUN apt-get update \
  && apt-get install -y python3 make g++ ca-certificates --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Enable corepack and pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Avoid pnpm interactive prompts during Docker build
ENV CI=true

# Copy app sources
COPY web/ ./

# Install and build
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built output and dependencies
COPY --from=builder /app .

EXPOSE 3002
CMD ["pnpm", "start"]
