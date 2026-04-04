# Digitec-PriceTracker

A self-hosted price tracker to monitor item prices and show price history.

## Selected Tech Stack

- **Language:** TypeScript
- **Frontend:** Next.js (React) — can serve UI and API routes
- **Backend:** Node.js (TypeScript) — optionally NestJS or Fastify
- **ORM:** Prisma
- **Database:** PostgreSQL (optionally TimescaleDB for time-series)
- **Scraper:** Playwright (Node)
- **Workers / Queue:** Redis + BullMQ
- **Object storage:** MinIO (S3-compatible) for snapshots/screenshots
- **Deployment:** Docker Compose (Traefik reverse proxy)

This stack is valid and sensible — it's modern, in-demand at startups, and well-suited for self-hosted deployments. It also looks strong on a CV for Zurich software roles.

# initial dev environment install

### fnm (Node version manager)
```bash
curl -fsSL https://fnm.vercel.app/install | bash
exec $SHELL
fnm install --lts
fnm default --lts
```

### pnpm (package manager)
```bash
corepack enable
corepack prepare pnpm@latest --activate
```


## Next steps

1. Scaffold a `docker-compose.yml` with `web`, `db`, `worker`, `redis`, and `traefik` services.
2. Add a `prisma` schema and initial migrations.
3. Implement a basic scraper and scheduled worker; store samples in Postgres.

## Quick start (local)

- Install Docker and Docker Compose.
- From the project root run:

```bash
docker compose up --build
```

