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

# Copy package manifests first for better layer caching
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml* ./

# Install all deps (including dev) for build
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY web/ ./
RUN pnpm build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy build output and manifest files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production deps only
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3002
CMD ["pnpm", "start"]
