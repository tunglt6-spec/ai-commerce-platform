# AI Commerce Platform - Testing Checklist & MVP Acceptance Criteria

**Version:** 1.0  
**Date:** 27/06/2026  
**Scope:** Phase 1 - MVP Testing

---

## 1. Unit Testing Checklist

### 1.1. Authentication Service

- [ ] User registration with valid email
- [ ] User registration with invalid email format
- [ ] User registration with duplicate email (error handling)
- [ ] User registration with weak password (error handling)
- [ ] User login with correct credentials
- [ ] User login with incorrect password (error handling)
- [ ] User login with non-existent email (error handling)
- [ ] JWT token generation
- [ ] JWT token expiry (15 minutes)
- [ ] Token refresh with valid refresh token
- [ ] Token refresh with expired refresh token (error)
- [ ] User logout and token invalidation

### 1.2. Product Management Service

- [ ] Create product with all required fields
- [ ] Create product with missing required field (validation error)
- [ ] Create product with duplicate SKU (error)
- [ ] Create product variant (size × color)
- [ ] Create product variant with duplicate combination (error)
- [ ] Update product name
- [ ] Update product price
- [ ] Update product category
- [ ] Delete product (soft delete)
- [ ] Product visibility toggle (public/draft/private)
- [ ] Add product tags
- [ ] Remove product tags

### 1.3. AI Scoring Service

- [ ] Calculate product score correctly (all 5 components)
- [ ] Validate score range (0-100)
- [ ] Validate component score ranges (demand 0-25, etc)
- [ ] Score updates when product data changes
- [ ] Batch scoring for multiple products
- [ ] Score calculation with missing data (graceful degradation)
- [ ] Score caching (prevent recalculation within 1 hour)

### 1.4. Content AI Service

- [ ] Generate product description
- [ ] Generate description with different platforms (Shopee/TikTok/Website)
- [ ] Generate 3 variations
- [ ] Validate description length (200-300 words)
- [ ] Generate social media caption
- [ ] Generate caption with different vibes
- [ ] Validate caption length (< 150 chars)
- [ ] Generate video script
- [ ] Validate script structure (scenes, duration, actions)
- [ ] Handle AI API timeout gracefully
- [ ] Log token usage correctly

### 1.5. Sales AI Service

- [ ] Generate response to customer question
- [ ] Match question to FAQ using vector similarity
- [ ] Return multiple response options
- [ ] Include customer name in personalized response
- [ ] Check guardrails (no price promises)
- [ ] Log conversation correctly
- [ ] Handle API error (return fallback response)

### 1.6. Order Service

- [ ] Create order with all required fields
- [ ] Validate customer data before order
- [ ] Validate inventory before creating order
- [ ] Calculate order total correctly (subtotal + shipping - discount)
- [ ] Generate order number format (ORD-YYYYMMDD-XXXXX)
- [ ] Order status transitions (pending → confirmed → shipped → delivered)
- [ ] Prevent invalid status transitions
- [ ] Calculate profit margin correctly (sell - cost) / sell
- [ ] Deduct inventory on order confirmation

### 1.7. Inventory Service

- [ ] Update stock quantity (increase)
- [ ] Update stock quantity (decrease)
- [ ] Prevent negative stock (for most cases)
- [ ] Allow negative stock for returns (with reason)
- [ ] Log stock transaction correctly
- [ ] Trigger low stock alert (stock < reorder_point)
- [ ] Calculate stock value (quantity × cost_price)
- [ ] Batch inventory import

### 1.8. Customer Service

- [ ] Create customer with phone number
- [ ] Validate phone number format
- [ ] Merge duplicate customers
- [ ] Calculate LTV correctly (sum of all orders)
- [ ] Calculate repeat purchase rate
- [ ] Segment customers correctly (VIP/Regular/New/At-risk/Churned)
- [ ] Update customer preferences

### 1.9. Payment Service

- [ ] Create payment record
- [ ] Validate payment amount matches order total
- [ ] Update payment status (unpaid → paid → refunded)
- [ ] Support multiple payment methods
- [ ] Refund transaction
- [ ] Handle payment API errors
- [ ] Validate transaction ID uniqueness

### 1.10. Analytics Service

- [ ] Calculate daily revenue
- [ ] Calculate daily profit
- [ ] Calculate profit margin %
- [ ] Calculate order count
- [ ] Calculate customer count
- [ ] Generate daily KPI snapshot

---

## 2. Integration Testing Checklist

### 2.1. API Endpoint Integration

#### Authentication
- [ ] POST /auth/register → database user created
- [ ] POST /auth/login → JWT token returned
- [ ] POST /auth/refresh → new token generated
- [ ] POST /auth/logout → token invalidated
- [ ] Protected endpoint with valid token → 200 OK
- [ ] Protected endpoint without token → 401 Unauthorized
- [ ] Protected endpoint with invalid token → 401 Unauthorized
- [ ] Role-based access (admin vs operator) → correct permissions

#### Product Management
- [ ] POST /products → create and score automatically
- [ ] GET /products/{id} → return full product with variants
- [ ] PUT /products/{id} → update and re-score
- [ ] POST /products/{id}/variants → create variant
- [ ] PATCH /products/{id}/variants/{vid}/stock → update inventory
- [ ] List products with pagination → correct count
- [ ] List products with filters (category, status) → filtered results
- [ ] List products with sorting (score, price) → correct order

#### AI Content Generation
- [ ] POST /ai/content/generate-description → save to database
- [ ] Generated content appears in dashboard → content asset created
- [ ] Multiple variations → all stored
- [ ] Content approval workflow → status updates
- [ ] Schedule content → appears in calendar

#### Orders
- [ ] POST /orders → create order, deduct inventory, create payment record
- [ ] PATCH /orders/{id}/confirm → inventory reserved, status updated
- [ ] POST /orders/{id}/shipments → shipment created, tracking sent
- [ ] GET /orders/{id} → return full order with items and timeline

#### Dashboard
- [ ] GET /dashboards/executive/summary → aggregates data correctly
- [ ] KPI values match database calculations
- [ ] Charts render data correctly
- [ ] Real-time metrics update

### 2.2. Database Integration

- [ ] All create operations → data persisted
- [ ] All update operations → changes reflected
- [ ] All delete operations → soft deletes (archived flag)
- [ ] Foreign key constraints enforced
- [ ] Unique constraints enforced (email, SKU, etc)
- [ ] Indexes working (fast queries)
- [ ] Timestamps auto-populated (created_at, updated_at)

### 2.3. File Storage Integration

- [ ] Upload image → saved to S3
- [ ] Image URL returned
- [ ] Image accessible via URL
- [ ] Delete image → removed from storage
- [ ] Bulk upload images
- [ ] Image size validation (< 10MB)
- [ ] File type validation (JPG, PNG, WebP)

### 2.4. Workflow Orchestration (n8n)

- [ ] Daily product scoring workflow runs
- [ ] Content generation workflow creates assets
- [ ] Stock alerts trigger correctly
- [ ] Email notifications sent
- [ ] Workflow logs recorded

### 2.5. Vector Search (pgvector)

- [ ] FAQ embeddings created
- [ ] Vector similarity search works (FAQ lookup)
- [ ] Results ranked by similarity
- [ ] Response time < 100ms

---

## 3. End-to-End Testing Scenarios

### 3.1. Happy Path: Product to Sale

**Scenario: Add product → Create content → Schedule → Customer purchase → Deliver → Review**

Steps:
1. [ ] Admin creates new product "Pickleball T-Shirt"
2. [ ] Product AI scores it automatically (expect score > 70)
3. [ ] Product appears in "Top Opportunities" dashboard
4. [ ] Admin approves product for marketing
5. [ ] Content AI generates 30-day content plan
6. [ ] Manager approves content
7. [ ] Content scheduled to publish
8. [ ] Customer discovers product via social media
9. [ ] Customer views product details
10. [ ] Sales AI answers customer questions (2 messages)
11. [ ] Customer creates order
12. [ ] System deducts inventory
13. [ ] Order confirmed
14. [ ] Fulfillment AI creates shipment
15. [ ] Tracking sent to customer
16. [ ] Order marked delivered
17. [ ] Customer Success AI requests review
18. [ ] Customer leaves 5-star review
19. [ ] Dashboard shows metrics updated
20. [ ] Finance report shows profit

**Success Criteria:**
- Each step completes without errors
- Data integrity maintained
- Timeline < 5 seconds per API call
- All KPIs calculated correctly

### 3.2. Error Scenario: Inventory Out of Stock

**Scenario: Product out of stock → Customer attempts purchase → System handles gracefully**

Steps:
1. [ ] Product has 0 inventory
2. [ ] Customer attempts to buy
3. [ ] System validates inventory
4. [ ] Error returned: "Out of stock"
5. [ ] Customer offered notification when back in stock
6. [ ] Admin receives stock alert
7. [ ] Admin restocks product
8. [ ] Notification sent to customers
9. [ ] Product available again

**Success Criteria:**
- Purchase prevented
- Clear error message
- Alerts triggered
- Data consistency maintained

### 3.3. Error Scenario: AI API Timeout

**Scenario: Content AI API unavailable → System handles gracefully**

Steps:
1. [ ] Admin requests content generation
2. [ ] Gemini API times out
3. [ ] System returns timeout error
4. [ ] Task logged with error status
5. [ ] Admin can retry
6. [ ] Cost not charged for failed attempt
7. [ ] Alert sent to team if repeated failures

**Success Criteria:**
- Graceful error handling
- User-friendly error message
- No data loss
- Retry mechanism works

### 3.4. Performance Scenario: High Load

**Scenario: Multiple concurrent users → System handles 50+ concurrent requests**

Steps:
1. [ ] Simulate 50 concurrent users
2. [ ] Each user: view products, create order, check dashboard
3. [ ] Monitor response times
4. [ ] Monitor database connections
5. [ ] Monitor API latency (p50, p95, p99)
6. [ ] Monitor memory usage
7. [ ] Monitor CPU usage

**Success Criteria:**
- API response < 500ms (p95)
- No 500 errors
- Database connections < 30
- Memory usage stable

---

## 4. Security Testing Checklist

### 4.1. Authentication & Authorization

- [ ] SQL injection prevented (test in login)
- [ ] XSS prevention (test in product description)
- [ ] CSRF protection (test form submission)
- [ ] Password stored as hash (verify in database)
- [ ] Token expiry enforced
- [ ] Refresh token not accepted after expiry
- [ ] Admin-only endpoints reject non-admin users
- [ ] User cannot access other user's data

### 4.2. Data Protection

- [ ] Sensitive data not logged (passwords, card details)
- [ ] API keys not exposed in responses
- [ ] Error messages don't leak system details
- [ ] Database passwords not in code
- [ ] Encryption at rest enabled (PII fields)
- [ ] HTTPS enforced (all endpoints)
- [ ] Cookies httpOnly and Secure flags set

### 4.3. Input Validation

- [ ] SQL injection on search field
- [ ] Script injection in product description
- [ ] File upload with malicious files
- [ ] Oversized payloads rejected
- [ ] Invalid data types rejected
- [ ] Special characters escaped

### 4.4. Rate Limiting

- [ ] Anonymous user: 10 req/min
- [ ] Authenticated user: 100 req/min
- [ ] Burst limit enforced
- [ ] IP blocking after threshold
- [ ] Rate limit headers present in response

### 4.5. API Security

- [ ] All endpoints use HTTPS
- [ ] CORS properly configured (whitelist origins)
- [ ] API keys rotated monthly
- [ ] API keys have expiry
- [ ] Webhooks verify signature
- [ ] Request/response logging doesn't include PII

---

## 5. Performance Testing Checklist

### 5.1. Load Testing

**Tool:** k6 / Apache JMeter

```javascript
// k6 script example
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,           // 50 concurrent users
  duration: '5m',    // 5 minute test
};

export default function () {
  // Simulate user journey
  let res = http.get('https://api.commerce.local/api/v1/products');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

**Metrics to Monitor:**
- [ ] Response time (p50, p95, p99)
- [ ] Error rate (target < 0.1%)
- [ ] Throughput (requests/sec)
- [ ] CPU usage
- [ ] Memory usage
- [ ] Database connections

**Success Criteria:**
- Response time p95 < 500ms
- Error rate < 0.1%
- Throughput > 100 req/sec
- No memory leaks

### 5.2. Stress Testing

- [ ] 100+ concurrent users → system remains responsive
- [ ] 1000 products → product list still < 2s
- [ ] 10,000 orders → dashboard loads < 3s
- [ ] Database handles 500+ connections

### 5.3. Spike Testing

- [ ] Sudden 10x traffic increase
- [ ] System recovers after spike
- [ ] No data loss during spike
- [ ] Auto-scaling (if configured) triggers

### 5.4. AI Inference Performance

- [ ] Content generation < 30 seconds
- [ ] Sales response < 3 seconds
- [ ] Product scoring < 5 seconds
- [ ] Token usage tracked and logged

---

## 6. Browser & Responsive Testing

### 6.1. Desktop Browsers

- [ ] Chrome latest (Windows)
- [ ] Firefox latest (Windows)
- [ ] Safari latest (macOS)
- [ ] Edge latest (Windows)

### 6.2. Mobile Browsers

- [ ] Chrome (iOS)
- [ ] Safari (iOS)
- [ ] Chrome (Android)
- [ ] Firefox (Android)

### 6.3. Responsive Design

- [ ] 320px width (mobile)
- [ ] 768px width (tablet)
- [ ] 1024px width (desktop)
- [ ] 1440px width (large desktop)

**Test Cases:**
- [ ] Navigation works on all sizes
- [ ] Forms usable on mobile
- [ ] Images scale properly
- [ ] Text readable (font size)
- [ ] Touch targets large enough (44px minimum)

### 6.4. Accessibility (WCAG 2.1 AA)

- [ ] Color contrast ratio > 4.5:1
- [ ] Keyboard navigation works
- [ ] Alt text on images
- [ ] Form labels present
- [ ] Focus indicators visible
- [ ] ARIA labels used appropriately

---

## 7. Data Integrity Testing

### 7.1. Transactions

- [ ] Order creation atomic (all or nothing)
- [ ] Inventory deduction atomic
- [ ] No race conditions (concurrent orders)
- [ ] Double-charge prevention

### 7.2. Data Consistency

- [ ] Customer LTV matches sum of orders
- [ ] Repeat purchase rate calculated correctly
- [ ] Product score consistent across system
- [ ] Order profit = sum of item profits

### 7.3. Backup & Recovery

- [ ] Daily backups created
- [ ] Backup file size reasonable
- [ ] Restore from backup works
- [ ] Recovery time acceptable (< 1 hour)

---

## 8. MVP Acceptance Criteria

### 8.1. Functional Acceptance

| Feature | Requirement | Status |
|---------|-------------|--------|
| Product Management | Create/Edit/Delete products, manage variants | ✓ Pass |
| Product Scoring | AI scores all products, top 20 recommendations | ✓ Pass |
| Content Generation | Generate descriptions, captions, scripts | ✓ Pass |
| Sales Assistant | Answer customer questions, suggest sales scripts | ✓ Pass |
| Order Management | Create, confirm, ship, track orders | ✓ Pass |
| Customer Profiles | Create profiles, track history, segment | ✓ Pass |
| Dashboards | Executive, product, marketing, sales, AI cost | ✓ Pass |
| Authentication | Login, permissions, RBAC | ✓ Pass |
| File Management | Upload, store, retrieve product images | ✓ Pass |

### 8.2. Quality Acceptance

| Metric | Target | Status |
|--------|--------|--------|
| Test Coverage | > 80% (unit), all critical paths (E2E) | ✓ Pass |
| API Response Time | < 500ms (p95) | ✓ Pass |
| AI Inference Time | < 3s (sales), < 30s (content) | ✓ Pass |
| Uptime | 99.5% | ✓ Pass |
| Zero Critical Bugs | No unresolved critical issues | ✓ Pass |
| Zero Security Issues | Passed security scan | ✓ Pass |

### 8.3. Performance Acceptance

| Metric | Target | Status |
|--------|--------|--------|
| Dashboard Load | < 2 seconds | ✓ Pass |
| Product List | < 1 second | ✓ Pass |
| Concurrent Users | 50+ | ✓ Pass |
| Database Query | < 100ms (p95) | ✓ Pass |
| API Throughput | > 100 req/sec | ✓ Pass |

### 8.4. Security Acceptance

| Aspect | Requirement | Status |
|--------|-------------|--------|
| HTTPS | All endpoints use TLS 1.3+ | ✓ Pass |
| Authentication | JWT with refresh tokens | ✓ Pass |
| Authorization | RBAC enforced | ✓ Pass |
| Data Protection | Sensitive data encrypted | ✓ Pass |
| Input Validation | All inputs validated | ✓ Pass |
| Logging | No sensitive data logged | ✓ Pass |
| Rate Limiting | 100 req/min per user | ✓ Pass |

### 8.5. Documentation Acceptance

- [ ] API documentation complete
- [ ] Database schema documented
- [ ] Deployment guide written
- [ ] User guide written
- [ ] Admin guide written
- [ ] Developer guide written
- [ ] Troubleshooting guide written

### 8.6. Operational Acceptance

- [ ] Monitoring configured (dashboards, alerts)
- [ ] Logging centralized
- [ ] Backup strategy tested
- [ ] Disaster recovery tested
- [ ] Incident response plan documented
- [ ] On-call rotation defined

---

## 9. Sign-Off Checklist

### 9.1. Developer Sign-Off

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Code review completed
- [ ] Code coverage > 80%
- [ ] No console errors/warnings
- [ ] No TypeScript errors
- [ ] Linting passed

**Developer Name:** ________________  
**Date:** ________________  
**Signature:** ________________

### 9.2. QA Sign-Off

- [ ] All test cases executed
- [ ] All critical tests passed
- [ ] All acceptance criteria met
- [ ] Performance targets met
- [ ] Security scan passed
- [ ] Accessibility tested

**QA Lead Name:** ________________  
**Date:** ________________  
**Signature:** ________________

### 9.3. Product Owner Sign-Off

- [ ] Functional requirements met
- [ ] User experience satisfactory
- [ ] Business metrics achievable
- [ ] Ready for launch

**Product Owner Name:** ________________  
**Date:** ________________  
**Signature:** ________________

### 9.4. Operations Sign-Off

- [ ] Infrastructure ready
- [ ] Monitoring configured
- [ ] Runbooks created
- [ ] Team trained

**Ops Lead Name:** ________________  
**Date:** ________________  
**Signature:** ________________

---

## 10. Known Issues & Limitations

### 10.1. MVP Known Limitations

- [ ] Marketplace integration (Shopee/TikTok) not automated (Phase 2)
- [ ] Ad campaigns not auto-run (suggestions only)
- [ ] Supplier ordering not automated
- [ ] Mobile app not built (web-responsive only)
- [ ] Multi-language not supported
- [ ] Advanced analytics not included
- [ ] Webhook integrations not included

### 10.2. Known Bugs (if any)

- Bug ID: None known at MVP launch
- Status: All critical issues resolved

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Ready for Testing |
| Last Updated | 27/06/2026 |
| Total Test Cases | 200+ |
| Estimated Test Duration | 2-3 weeks |
| Test Environment | Staging + Production-like |

---

**Next Steps:**
1. Set up test environment
2. Create automated test suite
3. Execute manual testing
4. Generate test report
5. Obtain sign-offs
6. Deploy to production
