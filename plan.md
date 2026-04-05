# Digitec-PriceTracker — Step-by-Step Setup Guide

> Platform: Raspberry Pi (ARM64, Debian-based)
> Prerequisites: nothing — we install everything from scratch

---

## Phase 1 — Install Components Bare-Metal

### 1.1 Git

```bash
sudo apt update
sudo apt install -y git curl unzip
```

**Check:**

```bash
git --version
# expect: git version 2.x.x
```

---

### 1.2 fnm (Node version manager)

fnm manages Node.js versions. Install it:

```bash
curl -fsSL https://fnm.vercel.app/install | bash
```

This adds fnm to your shell profile. Reload your shell so the `fnm` command is available:

```bash
exec $SHELL
```

**Check:**

```bash
fnm --version
# expect: fnm 1.x.x
```

---

### 1.3 Node.js + npm (via fnm)

```bash
fnm install --lts
fnm default lts-latest
exec $SHELL
```

**Check:**

```bash
node -v    # expect v22.x.x (or whatever the current LTS is)
npm -v     # expect 10.x.x
```

---

### 1.4 pnpm (package manager)

Enable corepack (ships with Node) and activate pnpm:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

**Check:**

```bash
pnpm -v
# expect: 10.x.x (or similar)
```

---

### 1.5 PostgreSQL

Install PostgreSQL from the Raspberry Pi OS (Debian) repos:

```bash
sudo apt update
sudo apt install -y postgresql postgresql-client
```

Start and enable the service:

```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Create a database and user for the project:

```bash
sudo -u postgres psql -c "CREATE USER digitec WITH PASSWORD 'changeme';"
sudo -u postgres psql -c "CREATE DATABASE digitec OWNER digitec;"
```

**Check:** Connect with the new user:

```bash
psql -h 127.0.0.1 -U digitec -d digitec -c "SELECT 1;"
# enter password: changeme
# expect:  ?column? | 1
```

---

### 1.6 Next.js (scaffold)

This creates the actual Next.js app for the project. Run from the project root:

```bash
cd /home/pi/Documents/development/Digitec-PriceTracker
pnpm create next-app@latest web -- --ts --tailwind --app --eslint --src-dir=false --import-alias="@/*"
```
Essentially this is the Hello World showing node and next are both working together.


This creates a `web/` folder with a working Next.js app.

**Check:**

```bash
cd web
pnpm dev
```

Open `http://<pi-ip>:3002` in a browser. You should see the default Next.js welcome page.

Stop the dev server with `Ctrl+C`.

---

### 1.7 Docker + Docker Compose

Install Docker using the official convenience script (works on Raspberry Pi):

```bash
curl -fsSL https://get.docker.com | sh
```

Add your user to the `docker` group so you don't need `sudo` for every Docker command:

```bash
sudo usermod -aG docker $USER
```

Log out and log back in (or reboot) for the group change to take effect.

**Check:**

```bash
docker --version       # expect: Docker version 2x.x.x
docker compose version # expect: Docker Compose version v2.x.x
docker run hello-world # expect: "Hello from Docker!" message
```

---

## Phase 2 — Hello World (Frontend + Backend separately)

### 2.1 Frontend Hello World (Next.js)

This verifies the Next.js frontend renders a page.

```bash
cd /home/pi/Documents/development/Digitec-PriceTracker/web
pnpm install
pnpm dev
```

Open `http://<pi-ip>:3002` in a browser. You should see the Next.js starter page with the Next.js logo.

**Check:** The page loads without errors. You see the Next.js logo and "To get started, edit the page.tsx file."

Stop with `Ctrl+C`.

---

### 2.2 Backend Hello World (Next.js API Route)

Next.js can serve API routes — these act as your backend. Create a simple API route:

Create the file `web/app/api/hello/route.ts`:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello from the backend!" });
}
```

Start the dev server again:

```bash
cd /home/pi/Documents/development/Digitec-PriceTracker/web
pnpm dev
```

**Check:** Open `http://<pi-ip>:3002/api/hello` in a browser or curl it:

```bash
curl http://localhost:3002/api/hello
# expect: {"message":"Hello from the backend!"}
```

Stop with `Ctrl+C`.

---

### 2.3 PostgreSQL Hello World

Verify the database works from Node.js with a tiny script. First install the `pg` (PostgreSQL client) package:

```bash
cd /home/pi/Documents/development/Digitec-PriceTracker/web
pnpm add pg
```

Then create a temporary file `web/test-db.mjs`:

```js
import pg from "pg";

const client = new pg.Client({
  connectionString: "postgresql://digitec:changeme@127.0.0.1:5432/digitec",
});

await client.connect();
const res = await client.query("SELECT NOW() AS now");
console.log("DB says the time is:", res.rows[0].now);
await client.end();
```

Run it:

```bash
cd /home/pi/Documents/development/Digitec-PriceTracker/web
node test-db.mjs
```

**Check:** Output like `DB says the time is: 2026-04-04T...`.

Delete the test file afterwards:

```bash
rm web/test-db.mjs
```

---

## Phase 3 — Integrate All Three Layers (Next.js + API Route + PostgreSQL)

This phase connects everything: the frontend calls an API route, which queries PostgreSQL.

### 3.1 Set up environment variables (secrets)

All passwords and connection strings live in **two** `.env` files — both are gitignored so secrets never get committed.

Create the **root `.env`** (used by Docker Compose):

Create `.env` in the project root:

```
COMPOSE_PROJECT_NAME=digitec-price-tracker

# Database credentials (single source of truth)
POSTGRES_USER=digitec
POSTGRES_PASSWORD=changeme
POSTGRES_DB=digitec

# Connection strings
DATABASE_URL=postgresql://digitec:changeme@db:5432/digitec
DATABASE_URL_LOCAL=postgresql://digitec:changeme@127.0.0.1:5432/digitec
```

Create **`web/.env.local`** (used by Next.js in dev mode):

```
DATABASE_URL=postgresql://digitec:changeme@127.0.0.1:5432/digitec
```

Create a **`.dockerignore`** in the project root so secrets don't leak into Docker images:

```
web/node_modules
web/.next
web/.env.local
.env
```

> **Important:** Both `.env` and `web/.env.local` are already in `.gitignore`. Never commit these files. When you change the password, update it in both files.

---

### 3.2 Create the database helper

First install the TypeScript types for `pg` (the runtime package was already installed in Phase 2.3):

```bash
cd /home/pi/Documents/development/Digitec-PriceTracker/web
pnpm add -D @types/pg
```

Now create the folder and file `web/lib/db.ts`:

```bash
mkdir -p web/lib
```

Create `web/lib/db.ts`:

```ts
import { Client } from "pg";

type DbStatus = { ok: boolean; message: string };

export async function checkDb(): Promise<DbStatus> {
  const conn = process.env.DATABASE_URL;
  if (!conn) return { ok: false, message: "DATABASE_URL not set" };

  const client = new Client({ connectionString: conn, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return { ok: true, message: "Connected" };
  } catch (err: any) {
    try { await client.end(); } catch {}
    return { ok: false, message: err?.message ?? String(err) };
  }
}
```

---
TODO
### 3.3 Create an API route that queries the DB

Create `web/app/api/db-check/route.ts`:

```ts
import { NextResponse } from "next/server";
import { checkDb } from "../../../lib/db";

export async function GET() {
  const status = await checkDb();
  return NextResponse.json(status);
}
```

---

### 3.4 Show the DB status on the frontend

Replace the contents of `web/app/page.tsx` with:

```tsx
import { checkDb } from "../lib/db";

export default async function Home() {
  const status = await checkDb();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Digitec Price Tracker</h1>
        <p
          className={`inline-block rounded-full px-4 py-2 text-sm font-medium ${
            status.ok
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {status.ok ? `DB: ${status.message}` : `DB Error: ${status.message}`}
        </p>
      </div>
    </div>
  );
}
```

This is a server component — it calls `checkDb()` at render time and shows a green or red badge.

---

### 3.5 Run and verify the full stack

```bash
cd /home/pi/Documents/development/Digitec-PriceTracker/web
pnpm dev
```

**Check (frontend):** Open `http://<pi-ip>:3002`. The page should show a green badge: `DB: Connected`.

**Check (API route):** In another terminal or browser:

```bash
curl http://localhost:3002/api/db-check
# expect: {"ok":true,"message":"Connected"}
```

**Check (failure case):** Stop PostgreSQL and refresh the page:

```bash
sudo systemctl stop postgresql
# refresh the browser — badge should turn red
sudo systemctl start postgresql
# refresh again — badge should turn green
```

If all three checks pass, the full stack is integrated. Stop with `Ctrl+C`.

---

## Phase 4 — Dockerize Everything

Now move the working app into Docker containers managed by docker-compose.

### 4.1 Stop bare-metal PostgreSQL (avoid port conflicts)

```bash
sudo systemctl stop postgresql
sudo systemctl disable postgresql
```

---

### 4.2 Create Docker files

Create `web/Dockerfile`:

```dockerfile
# Build stage
FROM node:20-bullseye-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y python3 make g++ ca-certificates --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV CI=true

COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ ./
RUN pnpm build

# Run stage
FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --prod --frozen-lockfile

EXPOSE 3002
CMD ["pnpm", "start"]
```

Create `docker-compose.yml` in the project root.

Docker Compose automatically reads the `.env` file from the same directory. Use `${VARIABLE}` to reference secrets — no passwords hardcoded here:

```yaml
services:
  web:
    build:
      context: .
      dockerfile: web/Dockerfile
    container_name: digitec_web
    depends_on:
      - db
    environment:
      DATABASE_URL: ${DATABASE_URL}
      NODE_ENV: production
      PORT: 3002
    ports:
      - 3002:3002
    restart: unless-stopped

  db:
    image: postgres:15
    container_name: digitec_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - db-data:/var/lib/postgresql/data
    # Uncomment to access DB from host:
    # ports:
    #   - 5432:5432

  pgweb:
    image: sosedoff/pgweb
    container_name: digitec_pgweb
    restart: unless-stopped
    depends_on:
      - db
    environment:
      PGWEB_DATABASE_URL: ${DATABASE_URL}?sslmode=disable
    ports:
      - 8089:8081

volumes:
  db-data:
```

---

### 4.3 Build and start

```bash
cd /home/pi/Documents/development/Digitec-PriceTracker
docker compose up --build
```

This will:
1. Pull the `postgres:15` image (ARM64 version — Raspberry Pi compatible)
2. Build the Next.js app in Docker
3. Start both containers
4. The `web` container connects to `db` using the `DATABASE_URL` in docker-compose.yml

**Note:** The first build on a Raspberry Pi will be slow (10-20+ minutes). Subsequent builds use cached layers and are much faster.

---

### 4.4 Verify

**Check (frontend):** Open `http://<pi-ip>:3002` (port 3002, as configured in docker-compose). You should see the Next.js page with a green `DB: Connected` badge.

**Check (API):**
```bash
curl http://localhost:3002/api/db-check
# expect: {"ok":true,"message":"Connected"}
```

**Check (containers running):**
```bash
docker compose ps
# expect: digitec_web (Up), digitec_db (Up), digitec_pgweb (Up)
```

**Check (DB viewer):** Open `http://<pi-ip>:8089` in a browser. You should see the pgweb interface connected to your database — no login needed. You can browse tables, run queries, and export data.

**Check (DB from host — optional):**

To connect to the Dockerised Postgres from your Pi (for debugging), temporarily uncomment the `ports` section under `db` in `docker-compose.yml`:

```yaml
    ports:
      - 5432:5432
```

Then:
```bash
docker compose up -d
psql -h 127.0.0.1 -U digitec -d digitec -c "SELECT 1;"
```

---

### 4.5 Stop and clean up

```bash
docker compose down          # stop containers, keep volumes (data persists)
docker compose down -v       # stop containers AND delete database volume (fresh start)
```

---

## Phase 5 — Where to Write Your App Code

Now that the full stack works end-to-end in Docker, here is where each piece of your application goes:

### Directory map

```
Digitec-PriceTracker/
│
├── docker-compose.yml          ← service orchestration (web, db, pgweb; add redis, worker, traefik later)
│
├── web/                        ← the Next.js app (frontend + backend API)
│   ├── app/
│   │   ├── layout.tsx          ← root layout (nav, providers, global wrappers)
│   │   ├── page.tsx            ← home page (replace with your dashboard)
│   │   ├── globals.css         ← global styles (Tailwind)
│   │   │
│   │   ├── products/           ← ⬅ CREATE: pages for tracked products
│   │   │   ├── page.tsx        ←   product list page
│   │   │   └── [id]/
│   │   │       └── page.tsx    ←   single product detail + price chart
│   │   │
│   │   └── api/                ← ⬅ backend API routes
│   │       ├── hello/route.ts  ←   test endpoint (created in Phase 2)
│   │       ├── db-check/route.ts ← health check (created in Phase 3)
│   │       ├── products/       ← ⬅ CREATE: CRUD endpoints for products
│   │       │   └── route.ts    ←   GET /api/products, POST /api/products
│   │       └── prices/         ← ⬅ CREATE: price history endpoints
│   │           └── route.ts    ←   GET /api/prices?productId=xxx
│   │
│   ├── lib/                    ← shared utilities
│   │   ├── db.ts               ← database connection (already exists)
│   │   └── queries.ts          ← ⬅ CREATE: reusable SQL queries / data access functions
│   │
│   ├── components/             ← ⬅ CREATE: React components
│   │   ├── PriceChart.tsx      ←   chart showing price over time
│   │   └── ProductCard.tsx     ←   product summary card
│   │
│   └── public/                 ← static assets (images, icons)
│
├── prisma/                     ← ⬅ CREATE: Prisma schema + migrations (when you switch from raw pg)
│   └── schema.prisma           ←   define Product, PriceRecord models
│
└── worker/                     ← ⬅ CREATE LATER: scraper + BullMQ worker (separate service)
    ├── package.json
    ├── Dockerfile
    └── src/
        ├── index.ts            ←   worker entry point (connects to Redis + BullMQ)
        └── scraper.ts          ←   Playwright scraper for Digitec
```

### What to do next (in order)

| # | Task | Where |
|---|------|-------|
| 1 | **Design the database schema** — define `Product` and `PriceRecord` tables | `prisma/schema.prisma` or raw SQL |
| 2 | **Create the tables** — run migration or execute SQL | `psql` or `pnpm prisma migrate dev` |
| 3 | **Build API routes** — CRUD for products, GET for price history | `web/app/api/products/route.ts`, `web/app/api/prices/route.ts` |
| 4 | **Build the frontend pages** — product list, product detail with chart | `web/app/products/page.tsx`, `web/app/products/[id]/page.tsx` |
| 5 | **Add the scraper worker** — Playwright script that fetches Digitec prices | `worker/src/scraper.ts` |
| 6 | **Add Redis + BullMQ** — schedule the scraper to run periodically | `docker-compose.yml` → add `redis` service, `worker/src/index.ts` |
| 7 | **Add Traefik** — reverse proxy with HTTPS | `docker-compose.yml` → add `traefik` service |

### Development workflow

For day-to-day coding, use **bare-metal dev mode** (faster iteration):

```bash
# Terminal 1: Start the database in Docker (just the DB, not the whole stack)
docker compose up db

# Terminal 2: Run Next.js in dev mode (hot reload)
cd web
pnpm dev
```

This gives you hot-reload on the frontend/API while using the Dockerised PostgreSQL. Set your `web/.env.local` to point at the Docker DB:

```
DATABASE_URL=postgresql://digitec:changeme@127.0.0.1:5432/digitec
```

(You need to uncomment the `ports: - 5432:5432` line under `db` in `docker-compose.yml` for this to work.)

When you want to test the full production build:

```bash
docker compose up --build
```

---

## Quick Reference — Commands Cheat Sheet

| Action | Command |
|--------|---------|
| Start everything (Docker) | `docker compose up --build` |
| Start DB only (Docker) | `docker compose up db` |
| Start frontend dev (bare-metal) | `cd web && pnpm dev` |
| Stop Docker | `docker compose down` |
| Reset DB (delete all data) | `docker compose down -v` |
| View logs | `docker compose logs -f web` |
| Open DB shell | `psql -h 127.0.0.1 -U digitec -d digitec` |
| Open DB viewer (pgweb) | `http://<pi-ip>:8089` |
| Install a new npm package | `cd web && pnpm add <package>` |
