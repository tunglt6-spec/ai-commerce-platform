# AI Commerce Platform - Hướng Dẫn Triển Khai Kỹ Thuật

**Phiên bản:** V1.0 - Technical Implementation  
**Ngày:** 27/06/2026  
**Trạng thái:** Sẵn sàng triển khai (Phase 1 - MVP)

---

## 1. Tổng Quan Kiến Trúc Hệ Thống

### 1.1. Stack Công Nghệ Khuyến Nghị

#### Frontend
- **Framework:** Next.js 14+ (React)
- **Styling:** Tailwind CSS
- **State Management:** Zustand / Redux Toolkit
- **UI Components:** ShadCN/UI
- **Responsive:** Mobile-first design
- **Build & Deploy:** Vercel hoặc Netlify

#### Backend
- **Runtime:** Node.js 20+ hoặc Python 3.11+
- **Framework:** NestJS (Node.js) hoặc FastAPI (Python)
- **API Style:** RESTful API + WebSocket cho real-time
- **Authentication:** JWT + OAuth2 ready
- **Validation:** Zod (Node) / Pydantic (Python)

#### Database & Storage
- **Primary DB:** PostgreSQL 15+
- **Vector DB:** pgvector (extension) hoặc Qdrant
- **Cache:** Redis 7+ (optional, giai đoạn 2)
- **File Storage:** AWS S3 / Cloudflare R2 / MinIO
- **Search:** PostgreSQL Full-Text Search (MVP) → Elasticsearch (Phase 2)

#### Workflow & Automation
- **Workflow Engine:** n8n self-hosted (tối ưu chi phí MVP)
- **Alternative:** Make / OpenClaw (khi cần connector nhanh)
- **Message Queue:** Bull (Node.js) / Celery (Python) cho background jobs

#### AI & LLM Gateway
- **Primary Gateway:** LiteLLM (OpenRouter) - unified API
- **Model Routing:**
  - Gemini 2.0 Flash: tác vụ thường
  - Qwen3 (Alibaba): tạo nội dung số lượng lớn
  - Claude Sonnet: tác vụ cao cấp (khi có ngân sách)
  - GPT-5 / Backup models qua OpenRouter
- **Embedding:** text-embedding-3-small (OpenAI) hoặc local models

#### Infrastructure
- **Container:** Docker + Docker Compose
- **Orchestration:** (MVP: single server) → Kubernetes (Phase 3)
- **Cloud Provider:** AWS / GCP / Azure hoặc VPS tự quản
- **CI/CD:** GitHub Actions / GitLab CI
- **Monitoring:** Prometheus + Grafana (Phase 2)

### 1.2. Kiến Trúc Lớp (Layered Architecture)

```
┌─────────────────────────────────────────────────┐
│        Presentation Layer (Web/Mobile)          │
│  Next.js Frontend + Admin Dashboard + Mobile   │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│     API Gateway & Business Logic Layer          │
│  NestJS/FastAPI + Controllers + Services        │
│  Auth, Validation, Rate Limiting                │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│       Workflow & Integration Layer              │
│  n8n Workflows + External API Integrations     │
│  Marketplace Connectors (Shopee/TikTok/etc)    │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│      AI Agent & Gateway Layer                   │
│  LiteLLM Router + Agent Orchestrator            │
│  Prompt Management + Token Optimization         │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│         Data Layer & Knowledge Base             │
│  PostgreSQL + pgvector + Vector Storage        │
│  Cache Layer (Redis)                            │
│  File Storage (S3)                              │
└─────────────────────────────────────────────────┘
```

---

## 2. Quy Trình Triển Khai MVP (Phase 1)

### 2.1. Sprint Planning (3-4 tuần)

**Sprint 1 (Tuần 1):** Foundation & Database
- Cài đặt project structure (Docker + backend + frontend)
- Thiết kế & migrate database schema (Products, Orders, Customers, etc.)
- Tạo authentication system (JWT + User roles)
- API endpoints cơ bản (CRUD Products, Orders)

**Sprint 2 (Tuần 2-3):** AI Agents & Core Features
- Integrate LiteLLM + Gemini Flash
- Build Product AI (scoring engine)
- Build Content AI (caption/description generator)
- Build Sales Script AI (FAQ/response templates)
- Create Product Management dashboard

**Sprint 3 (Tuần 3-4):** Integration & Dashboard
- Build Order Management system
- Create Executive Dashboard (KPI tracking)
- Integrate n8n workflows (basic automation)
- Testing & bug fixes
- MVP release

### 2.2. Deployment Checklist

- [ ] Database migrations tested
- [ ] Environment variables configured (.env)
- [ ] AI API keys stored securely (no hardcoding)
- [ ] Backend API tested (Postman/Insomnia)
- [ ] Frontend connected to backend
- [ ] Basic authentication working
- [ ] File uploads working (S3/local)
- [ ] Error handling & logging implemented
- [ ] Docker build successful
- [ ] Performance tested (load testing)
- [ ] Security scan passed (OWASP top 10)
- [ ] Backup strategy defined
- [ ] Monitoring & alerting configured

---

## 3. Development Guidelines

### 3.1. Code Organization

```
ai-commerce-platform/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── products/
│   │   │   ├── orders/
│   │   │   ├── customers/
│   │   │   ├── content/
│   │   │   ├── ai-agents/
│   │   │   ├── auth/
│   │   │   └── dashboard/
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── filters/
│   │   │   └── decorators/
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   ├── seeds/
│   │   │   └── entities/
│   │   ├── config/
│   │   └── main.ts
│   ├── test/
│   ├── docker-compose.yml
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── services/
│   │   ├── utils/
│   │   └── styles/
│   ├── public/
│   └── package.json
├── workflows/
│   ├── n8n-workflows/ (exported JSON)
│   └── integration-schemas/
├── docs/
│   ├── api-specification.md
│   ├── database-schema.md
│   └── deployment-guide.md
└── README.md
```

### 3.2. Naming Conventions

- **Database tables:** snake_case (products, order_items)
- **API endpoints:** kebab-case (/api/v1/product-scores)
- **React components:** PascalCase (ProductCard.tsx)
- **Functions/variables:** camelCase (createProduct, fetchOrders)
- **Constants:** UPPER_SNAKE_CASE (MAX_ITEMS_PER_PAGE)
- **Environment variables:** UPPER_SNAKE_CASE (DATABASE_URL, GEMINI_API_KEY)

### 3.3. API Versioning

- Sử dụng URL versioning: `/api/v1/...`
- Backward compatibility: giữ v1 khi thêm v2
- Deprecation policy: announce 2 phiên bản trước khi xóa

### 3.4. Error Handling

```typescript
// Unified Error Response Format
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product with ID 123 not found",
    "status": 404,
    "timestamp": "2026-06-27T10:30:00Z",
    "traceId": "abc-123-def"
  }
}
```

---

## 4. AI Agent Integration Pattern

### 4.1. Agent Orchestration Flow

```
User Request
    ↓
API Endpoint (Controller)
    ↓
Service Layer (Business Logic)
    ↓
AI Gateway (LiteLLM)
    ↓
Model Selection (Chi phí + Complexity)
    ↓
Prompt Execution
    ↓
Output Validation
    ↓
Database Update / Cache
    ↓
Response to User
```

### 4.2. Prompt Management

- Lưu tất cả prompts trong database (không hardcode)
- Version prompts giống như code (git-like)
- A/B test prompts tự động
- Log tất cả prompt executions (audit trail)

**Ví dụ cấu trúc:**
```typescript
interface PromptTemplate {
  id: string;
  name: "content_caption" | "product_scoring" | etc;
  version: number;
  template: string; // Handlebars/Jinja2 format
  parameters: PromptParameter[];
  model: string;
  temperature: number;
  maxTokens: number;
  createdAt: Date;
  status: "active" | "archived";
}
```

### 4.3. Token Optimization

- Sử dụng prompt caching (jika tersedia di model)
- Batch requests (aggregate multiple tasks)
- Truncate context (keep only relevant data)
- Monitor token usage per agent (dashboard)
- Set alerts khi token usage spike

---

## 5. Security & Compliance

### 5.1. Authentication & Authorization

- **Authentication:** JWT + Refresh tokens
- **Authorization:** RBAC (Admin, Manager, Operator, Viewer)
- **2FA:** Optional (Phase 2)
- **Session management:** JWT stored in httpOnly cookies
- **CORS:** Whitelist specific origins

### 5.2. Data Security

- **Encryption at rest:** Database encryption (PostgreSQL pgcrypto)
- **Encryption in transit:** HTTPS/TLS 1.3
- **API keys:** HashiCorp Vault atau AWS Secrets Manager
- **Sensitive data:** PII masked in logs
- **Database backups:** Daily encrypted backups + 30-day retention

### 5.3. AI Safety Guardrails

- AI không được tự confirm pembayaran tanpa approval
- AI tidak auto-publish content tanpa review untuk production
- Semua AI decisions harus dapat di-audit (log lengkap)
- Rate limiting per user/IP untuk mencegah abuse
- Content filtering untuk spam/sensitive content

### 5.4. Compliance Checklist

- [ ] GDPR ready (data export/deletion for users)
- [ ] PCI DSS aware (if handling payments directly)
- [ ] Local law compliance (Vietnam e-commerce)
- [ ] Terms of Service & Privacy Policy
- [ ] AI disclosure (inform users yang berbicara dengan AI)
- [ ] Data retention policy

---

## 6. Monitoring & Logging

### 6.1. Logging Strategy

```typescript
// Structured logging
logger.info("Product created", {
  productId: "123",
  categoryId: "fashion",
  userId: "user-456",
  timestamp: new Date()
});

logger.warn("AI token usage high", {
  agent: "content_ai",
  tokensUsed: 50000,
  estimatedCost: 0.50,
  threshold: 100000
});

logger.error("Fulfillment failed", {
  orderId: "order-789",
  error: "Inventory check failed",
  stack: error.stack
});
```

### 6.2. Key Metrics to Track

1. **Business Metrics:**
   - Revenue, Profit, ROI
   - Product conversion rate
   - Customer acquisition cost (CAC)
   - Lifetime value (LTV)

2. **AI Metrics:**
   - Token usage (cost tracking)
   - Model inference latency
   - Success rate per agent
   - Hallucination/error rate

3. **System Metrics:**
   - API response time (p50, p95, p99)
   - Error rate (5xx, 4xx)
   - Database query performance
   - Concurrent users

---

## 7. Performance Optimization

### 7.1. Frontend Optimization

- Code splitting (route-based)
- Image optimization (WebP, lazy loading)
- CSS optimization (Tailwind purge)
- Bundle analysis (check bundle size)
- Lighthouse score target: >80

### 7.2. Backend Optimization

- Database indexing (B-tree on frequently queried columns)
- Query optimization (JOIN, avoid N+1)
- Pagination (default 20, max 100)
- Caching strategy (Redis for product listings)
- API rate limiting (100 req/min per user)

### 7.3. AI Inference Optimization

- Batch inference (group multiple requests)
- Prompt caching (reuse common contexts)
- Model quantization (if using local models)
- Async processing (background jobs for long tasks)

---

## 8. Testing Strategy

### 8.1. Testing Pyramid

```
         /\
        /  \  E2E Tests (Cypress/Playwright)
       /    \ 20% - Critical user flows only
      /------\
     /        \  Integration Tests (Jest)
    /          \ 30% - API endpoints, database
   /------------\
  /              \  Unit Tests (Jest)
 /                \ 50% - Services, utilities
/------------------\
```

### 8.2. Test Coverage Goals

- Unit tests: >80% coverage
- Integration tests: Critical paths only
- E2E tests: Happy path + critical error cases
- Performance tests: Load testing at 2x expected peak load

### 8.3. Testing Tools

- **Unit/Integration:** Jest
- **E2E:** Playwright (simpler) atau Cypress
- **API Testing:** Postman / REST Client
- **Load Testing:** k6 / Apache JMeter
- **Security:** OWASP ZAP, npm audit

---

## 9. Deployment & DevOps

### 9.1. Infrastructure as Code (IaC)

```dockerfile
# Dockerfile example
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
EXPOSE 3000
CMD ["node", "src/main.js"]
```

### 9.2. Deployment Pipeline

```
Git Push → GitHub Actions → Build → Test → Deploy to Staging
  ↓
Manual Approval
  ↓
Deploy to Production
```

### 9.3. Rollback Strategy

- Blue-green deployment (maintain 2 versions)
- Database migrations: backward-compatible
- Feature flags (enable/disable features without redeploy)
- Automated rollback on error rate spike

---

## 10. Maintenance & Support

### 10.1. Post-MVP Support (Phase 1+)

- Daily monitoring & alerting
- Weekly security updates
- Monthly performance review
- Quarterly architecture review
- Documentation updates as features change

### 10.2. Scaling Considerations (Future)

- **Phase 2:** Add caching layer (Redis), search engine (Elasticsearch)
- **Phase 3:** Kubernetes for orchestration, CDN for media
- **Phase 4:** Multi-region deployment, API rate limiting
- **Phase 5:** GraphQL API (optional), microservices (if needed)

---

## 11. Key Contact & Escalation

| Role | Responsibility | Contact |
|------|----------------|---------|
| Product Owner | Vision, priorities | Tùng |
| Tech Lead | Architecture, code quality | [Name] |
| DevOps | Infrastructure, deployment | [Name] |
| QA Lead | Testing, quality assurance | [Name] |

---

## Appendix: Useful Commands

```bash
# Docker setup
docker-compose up -d

# Database migration (NestJS example)
npm run migration:run

# Run tests
npm run test
npm run test:e2e

# Build for production
npm run build

# Deploy to production
npm run deploy:prod
```

---

**Document Version:** 1.0  
**Last Updated:** 27/06/2026  
**Next Review:** After Phase 1 completion
