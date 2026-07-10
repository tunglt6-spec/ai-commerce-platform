# AI Commerce Platform — MVP (Implementation)

AI Teammate for multi-category e-commerce. Monorepo: **NestJS** backend + **Next.js** frontend + **PostgreSQL/pgvector**, orchestrated with Docker Compose.

> This is the running application. The numbered `0X_*.md` files + `.docx/.pdf` are the approved design specification (source of truth).

## Stack
- **Backend:** NestJS 10, Prisma 5, PostgreSQL 15+/pgvector, JWT (access+refresh, Argon2), RBAC, multi-tenant.
- **Frontend:** Next.js 14 (App Router), Tailwind, Zustand.
- **AI:** LiteLLM/OpenRouter-compatible gateway adapter with graceful fallback; Product AI (deterministic scoring), Content AI.

## Quick start (Docker — recommended)
```bash
cp .env.example .env         # then edit secrets
docker compose up -d --build # postgres + backend (auto-migrate) + frontend
# backend runs `prisma migrate deploy` on boot (safe, non-destructive)
docker compose exec backend npx ts-node prisma/seed.ts   # optional demo data
```
- Frontend: http://localhost:3000  · Backend: http://localhost:3001/api/v1
- Health: `GET /api/v1/health` (live), `GET /api/v1/health/ready` (DB check)
- Seed admin: `admin@commerce.local` / `Admin@12345` (change in production)

## Local development
```bash
npm install
docker compose up -d postgres            # DB only (host port 5433 by default)
npm run db:migrate --workspace backend   # or: cd backend && npx prisma migrate deploy
npm run db:seed --workspace backend
npm run dev:backend   # http://localhost:3001
npm run dev:frontend  # http://localhost:3000
```

> Note: `.env` sets host DB port **5433** to avoid clashing with a native Postgres on 5432. Containers talk to `postgres:5432` internally.

## Tests
```bash
npm run test:backend   # unit (Jest)
npm run test:e2e       # e2e (auth, tenant isolation, order lifecycle) — needs DB up
npm run lint           # backend eslint (--max-warnings=0)
```

## Operations
| Action | Command |
|--------|---------|
| Start | `docker compose up -d` |
| Stop | `docker compose down` (keeps data) |
| Logs | `docker compose logs -f backend` |
| Migrate | auto on backend boot, or `docker compose exec backend npx prisma migrate deploy` |
| Migration status | `docker compose exec backend npx prisma migrate status` |
| Backup DB | `docker exec commerce_postgres pg_dump -U commerce ai_commerce > backup_$(date +%F).sql` |
| Restore DB | `cat backup.sql \| docker exec -i commerce_postgres psql -U commerce -d ai_commerce` |
| Rollback app | redeploy previous image tag / `git checkout <prev> && docker compose up -d --build` |
| Health | `curl localhost:3001/api/v1/health/ready` |

## Environment variables
See `.env.example`. Required in production: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (long random), `CORS_ORIGINS`, `NEXT_PUBLIC_API_BASE_URL`. AI is optional: set `AI_GATEWAY_BASE_URL` + `AI_GATEWAY_API_KEY` to enable content generation (otherwise agents degrade gracefully — no fabricated output).

## Security highlights
- JWT access (15m) + rotating refresh (opaque, SHA-256 hashed at rest).
- RBAC (admin/manager/operator/viewer) enforced server-side + tenant isolation on every query.
- Helmet, global rate limiting, structured error responses (no stack traces to clients), audit log on all mutations.
