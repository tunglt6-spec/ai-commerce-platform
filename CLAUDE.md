# AI Commerce Platform (AICP) - Project Memory

This file is the shared implementation context for Claude Code and Codex.
It is distilled from the project documents, current codebase, env templates,
database schema, API spec, Docker setup, README files, DOCX/PDF package, and
the AICP overview image.

Do not paste secrets from `.env` into chats, logs, commits, docs, or generated
context files. Treat `.env` as local-only runtime state.

## Product Vision

AICP is an "AI Teammate" commerce platform for multi-category selling. It starts
as an MVP for real commerce operations, then expands into a reusable AI commerce
operating system.

Primary business promise:

- Automate repetitive sales and operations work.
- Help select and score products using data.
- Generate product copy, captions, scripts, FAQs, and sales responses.
- Manage products, customers, orders, fulfillment, content, and analytics.
- Work across website, Facebook, Instagram, TikTok, Zalo, YouTube, Shopee,
  Lazada, Tiki, email, SMS, and chatbot channels over time.

Initial recommended verticals:

- Sports fashion: pickleball, badminton, football, gym, running.
- Sports accessories: bags, grips, towels, water bottles, socks, hats.
- Later expansion: cosmetics, home goods, tech accessories, food/health,
  mother and baby, digital products, and other commerce niches.

## MVP Scope

In MVP:

- Product management: CRUD, variants, inventory.
- Product AI scoring and top recommendations.
- Content AI: descriptions, captions, video scripts.
- Sales AI: scripts, FAQ, assisted customer responses.
- Basic order management: create, confirm, ship, track, cancel.
- Customer profiles, history, segmentation.
- Dashboards: executive, product intelligence, marketing/sales, AI cost.
- Authentication, refresh tokens, RBAC, tenant isolation.
- File upload and local media storage.
- Admin/operator web panel.

Out of MVP / Phase 2+:

- Automated Shopee/TikTok marketplace sync.
- Automated ad campaign creation and bidding.
- Automated supplier ordering.
- Native mobile app.
- Multi-language product.
- Warehouse management system.
- Advanced custom reporting and predictive analytics.
- Third-party integration marketplace.

## Stack And Architecture

Current implementation uses:

- Monorepo npm workspaces: `backend`, `frontend`.
- Backend: NestJS 10, TypeScript, Prisma 5, PostgreSQL, pgvector.
- Frontend: Next.js 14 App Router, React 18, Tailwind CSS, Zustand, Recharts,
  lucide-react.
- Auth/security: JWT access token, rotating refresh tokens hashed at rest,
  RBAC roles, tenant isolation, Helmet, rate limiting, global exception filter,
  audit logging on mutations.
- Infra: Docker Compose, Postgres pgvector image, backend/frontend Dockerfiles,
  deploy scripts and VPS/Caddy/Nginx docs.
- AI gateway: LiteLLM/OpenRouter-compatible gateway via
  `AI_GATEWAY_BASE_URL` and `AI_GATEWAY_API_KEY`. If missing, AI services should
  degrade gracefully and avoid fabricated output.

Layering pattern:

1. Controller receives request.
2. DTO validation and auth/RBAC guards run.
3. Service applies business logic and tenant scoping.
4. Prisma persists/queries state.
5. AI gateway is called only by AI/service layer where needed.
6. AI output is validated, saved as task/content/state, then returned.

## AI Teammate Model

Main agents from the design docs:

- CEO AI / Business Orchestrator: strategic decisions, human approval gates.
- Trend Hunter AI: discovers market/product trends.
- Product AI: scores opportunity with demand, competition, margin, content
  viability, and risk.
- Content AI: product descriptions, captions, video scripts, campaign copy.
- Video AI: video/image generation planning.
- Ads AI: ad ideas and campaign suggestions.
- Sales AI: customer response, FAQ, scripts, objections, closing support.
- Fulfillment AI: mostly deterministic logistics/order checks, no LLM by default.
- Raving Fan / Customer Success AI: follow-up, win-back, upsell, reviews.
- BI Analyze AI: reporting, insights, optimization suggestions.
- Finance AI: cost/profit reporting.
- Supplier AI: future phase.

Model routing principles:

- Deterministic workflow/calculation: no LLM; use code/workflow/API.
- Real-time under 3 seconds: Gemini Flash by default.
- Batch content generation: Qwen3 or cheaper long-form model.
- Complex strategy/high-stakes decisions: Claude Sonnet/GPT-class model, usually
  behind CEO AI and human approval.
- Use prompt caching, context truncation, batching, and daily token budgets.

## Product Scoring Formula

Product AI scoring should preserve the documented weighting:

```text
Score = Demand * 0.25
      + Margin * 0.25
      + ContentViability * 0.15
      + LowRisk * 0.15
      + LowCompetition * 0.20
```

Expected breakdown:

- Demand: 0-25
- Competition: 0-20
- Profit margin: 0-25
- Content viability: 0-15
- Risk: 0-15
- Total: 0-100

Recommendations should be clear, such as HIGH / MEDIUM / PASS.

## Current Repository State

Important files read:

- `.env`, `.env.example`, `.gitignore`
- `01_Technical_Implementation_Guide.md`
- `02_Functional_Requirements.md`
- `03_Database_Schema.sql`
- `04_API_Specification.md`
- `05_Workflow_Agent_Documentation.md`
- `06_Testing_Checklist_Acceptance_Criteria.md`
- `07_Project_Timeline_Roadmap.md`
- `08_Budget_Plan_AI_Models_Recommendation.md`
- `08_Budget_Plan_AI_Models_Recommendation-1.md`
- `09_Quick_Reference_Guide.md`
- `PROJECT_README.md`, `README.md`
- `docker-compose.yml`, root `package.json`, `package-lock.json`
- `AI_Commerce_Platform_AI_Teammate_Tai_lieu_thiet_ke.docx`
- `AI_Commerce_Platform_Tai_Lieu_Toan_Dien.docx`
- `AI_Commerce_Platform_Tai_Lieu_Toan_Dien.pdf`
- `file_00000000f0c0720682061be90aa0388a.png`
- `.claude/launch.json`

Notes:

- The two budget markdown files are byte-identical by SHA-256 prefix:
  `525d3c3c9ee191db`.
- The PDF appears to be the comprehensive document version; the matching DOCX
  was text-extracted successfully and should be treated as the accessible source.
- `.claude/launch.json` currently launches only the frontend:
  `npm --prefix frontend run dev` on port `3000`.
- `.env` has real local values for runtime, Postgres, JWT, frontend/backend,
  and seed admin. AI gateway fields are empty/placeholders, so AI should run in
  graceful fallback unless configured.
- `.gitignore` excludes `.env`, `.env.local`, local env variants, logs, coverage,
  build outputs, local uploads, backups, and Docker local data.

## Current Backend Modules

Backend routes detected from controllers:

- Auth: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`,
  `/auth/change-password`.
- Users: `GET /users/me`, `GET /users`, `PATCH /users/:userId/role`.
- Categories: CRUD under `/categories`.
- Products: CRUD under `/products`, variants, stock update.
- Customers: create/list/detail/update under `/customers`.
- Orders: create/list/detail/confirm/ship/cancel under `/orders`.
- Fulfillment: fulfillment check, deliver, complete, exception list.
- Returns: create order return, list returns, update return.
- Content: content CRUD-ish flow, submit, approve, schedule, content calendar.
- FAQ/Sales: FAQ CRUD/search and `POST /ai/sales/respond`.
- AI: product scoring, content generation, video generation, trend analysis,
  AI task listing/detail/approval, AI cost summary.
- Analyze: `POST /ai/analyze/insights`.
- Raving Fan: follow-up, win-back, upsell, recompute segments.
- Integrations: list/connect/disconnect/test providers.
- Notifications: list notifications.
- Workflows: list workflows, run named workflow, list/detail executions.
- Dashboard: executive summary and product intelligence.
- Uploads: `POST /uploads`.
- Health: `/health`, `/health/ready`.

## Database Model Memory

The project has both a large SQL design and Prisma implementation. Current
Prisma models include:

- User, Tenant, UserTenant, RefreshToken
- Category, Product, ProductVariant, StockTransaction
- Customer, CustomerConversation, Message
- Order, OrderItem, Payment, Return
- ContentAsset, ContentCalendar
- FaqItem with pgvector embedding support
- AiAgentTask, PromptTemplate, WorkflowExecution
- DailyKpiSnapshot, FinancialTransaction, AuditLog
- Integration

Database design docs also mention `api_keys`, `knowledge_base`,
`product_performance`, and other analytics objects. Check Prisma before assuming
a table from the SQL design exists in the live app.

## API Spec Anchor

The formal API spec covers:

- Auth: register, login, refresh, logout.
- Products: create, list, detail, update, variants, stock.
- AI content: generate description, caption, video script, history.
- Sales/customers: sales scripts, customer create/detail.
- Orders: create, detail, confirm, shipment, list.
- Dashboards: executive, product intelligence, AI cost.
- Content calendar: schedule and approve.
- Standard error format, pagination, rate limiting.
- Webhooks are future.

When implementing, prefer the current controller/service contracts if they exist,
but keep the formal API spec as the product contract to reconcile gaps.

## Local Commands

Root commands:

```bash
npm install
npm run dev:backend
npm run dev:frontend
npm run build
npm run build:backend
npm run build:frontend
npm run test:backend
npm run test:e2e
npm run lint
npm run db:generate
npm run db:migrate
npm run db:seed
npm run compose:up
npm run compose:down
```

Local development flow from `PROJECT_README.md`:

```bash
npm install
docker compose up -d postgres
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
npm run dev:backend
npm run dev:frontend
```

Ports:

- Frontend: `3000`
- Backend: `3001`
- Host Postgres may use `5433` to avoid local Postgres conflicts.
- Containers talk to Postgres internally as `postgres:5432`.

## Environment Rules

Required production variables:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`
- `NEXT_PUBLIC_API_BASE_URL`

Important optional variables:

- `AI_GATEWAY_BASE_URL`
- `AI_GATEWAY_API_KEY`
- `AI_MODEL_DEFAULT`
- `AI_MODEL_CONTENT`
- `AI_MODEL_STRATEGY`
- `AI_DAILY_TOKEN_BUDGET`
- `INTEGRATION_ENC_KEY`
- `UPLOAD_DIR`

Production requirements:

- JWT secrets must be long random strings.
- `INTEGRATION_ENC_KEY` should be set explicitly; deriving from JWT secret is
  dev-only.
- Never commit `.env` or production secrets.

## Testing And Acceptance Targets

Documented targets:

- Unit coverage: over 80%.
- API p95: under 500 ms.
- Dashboard load: under 2 seconds.
- AI response: under 3 seconds for sales/chat, under 30 seconds for content.
- Database p95 query: under 100 ms.
- MVP concurrent users: at least 50-100 depending on checklist.
- Security: no critical issues, RBAC enforced, tenant isolation enforced,
  no sensitive data in logs.
- E2E should cover happy path product-to-sale, out-of-stock, AI timeout, and
  critical auth/order/dashboard flows.

Known MVP limitations from docs:

- No automated marketplace integration.
- No auto-run ads.
- No supplier ordering automation.
- No native mobile app.
- No multi-language support.
- No advanced analytics/custom reports.
- No webhook integrations.

## Budget And Roadmap Memory

Roadmap:

- Phase 0: preparation.
- Phase 1: 4-week MVP.
- Sprint 1: foundation, auth, DB, core CRUD.
- Sprint 2: AI gateway, product scoring, content AI.
- Sprint 3: frontend, dashboards, order management, AI cost.
- Sprint 4: Sales AI, customer management, payment/fulfillment, QA, launch prep.
- Phase 2+: marketplace integration, advanced automation, predictive analytics,
  scaling.

Budget docs estimate:

- MVP build: about USD 56,650.
- Monthly operations after launch: about USD 13k range in ramp-up.
- Optimized AI cost target is very low compared with team/infrastructure cost.
- AI monthly cost estimates in docs are planning assumptions and should be
  revalidated against current provider pricing before financial decisions.

Risk focus:

- AI API rate limits and cost overrun.
- Scope creep.
- Database performance with larger datasets.
- Marketplace API integration delays.
- Team knowledge continuity.

## Implementation Guidance

When continuing development:

- Read current code before changing behavior; the implementation already goes
  beyond the original docs in some modules.
- Preserve tenant isolation on every query.
- Keep role checks server-side.
- Use DTO validation and structured errors.
- Do not fabricate AI results when AI gateway is unavailable; return graceful
  fallback status or deterministic local output where appropriate.
- Log AI tasks, token usage, estimated cost, model used, status, errors, and
  execution time.
- Use deterministic services for fulfillment/order state transitions instead of
  LLMs.
- Keep content approval/human-in-the-loop for generated assets.
- Keep frontend as the actual operator console, not a marketing landing page.
- Prefer existing modules/patterns over adding new architecture.
- Before claiming done, run relevant build/test/lint commands.

## Immediate Next Work Candidates

Potential follow-ups to verify or complete:

- Run backend tests, e2e tests with DB, lint, and full build.
- Compare current API routes to `04_API_Specification.md` and list gaps.
- Compare Prisma schema to `03_Database_Schema.sql` and list missing tables or
  intentionally omitted MVP tables.
- Add backend routes for documented API gaps if required.
- Add/update frontend screens to cover all MVP workflows.
- Configure AI gateway and validate graceful fallback behavior.
- Verify Docker Compose startup from a clean state.
- Review uploaded files under `backend/uploads`; keep sample assets only if they
  are intentional.
- Decide whether `.claude/launch.json` should also start backend and database,
  not only frontend.

## Verification Snapshot - 2026-07-11

Commands run successfully:

```bash
npm run test:backend
npm run build:backend
npm run build:frontend
npm run lint
```

Results:

- Backend unit tests passed: 3 suites, 12 tests.
- Backend Nest build passed.
- Backend ESLint passed with `--max-warnings=0`.
- Frontend Next production build compiled and generated 16 routes.

Frontend build warnings to address later:

- `frontend/next.config.js` has an invalid top-level key:
  `outputFileTracingRoot`. In the installed Next 14 schema this key belongs
  under `experimental`.
- Next attempted to patch missing SWC optional dependencies in the lockfile and
  emitted `npm ENOWORKSPACES`; build still exited successfully and git status
  showed no lockfile changes.
