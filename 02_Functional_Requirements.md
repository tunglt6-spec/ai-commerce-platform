# AI Commerce Platform - Yêu Cầu Chức Năng Chi Tiết (FRD)

**Phiên bản:** V1.0 - MVP Phase 1  
**Ngày:** 27/06/2026  
**Phạm vi:** MVP bao gồm các Module chính cho ngành Thời trang/Phụ kiện Thể thao

---

## 1. Quản Lý Sản Phẩm & Danh Mục

### 1.1. Nhập Sản Phẩm Cơ Bản

**FR-PROD-001: Tạo Sản Phẩm Mới**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Operator / Admin |
| **Đầu vào** | SKU, Tên sản phẩm, Danh mục, Giá vốn, Giá bán lẻ, Mô tả ngắn, Ảnh đại diện |
| **Xử lý** | System tạo product record, gọi Product AI để suggest scoring |
| **Đầu ra** | Product created (id, sku, name, score) |
| **Validation** | SKU unique, giá > 0, bắt buộc ảnh đại diện |

**FR-PROD-002: Quản Lý Biến Thể Sản Phẩm (Size/Màu)**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Operator / Admin |
| **Đầu vào** | Product ID, Size options (XS/S/M/L/XL), Color options (Red/Blue/etc) |
| **Xử lý** | System tạo product_variants (cartesian product: size × color), tồn kho ban đầu = 0 |
| **Đầu ra** | Variants created (sku, size, color, stock) |
| **Validation** | Không dupicate (size + color), sku format: parent_sku-size-color |

**FR-PROD-003: Cập Nhật Tồn Kho**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Operator / Fulfillment AI |
| **Đầu vào** | Variant ID, Quantity adjust (+ hoặc -), Reason (new stock, sold, return) |
| **Xử lý** | Update stock, log transaction, trigger alert nếu stock < reorder point |
| **Đầu ra** | Stock updated, audit log |
| **Validation** | Stock không được âm (except return), lý do bắt buộc |

**FR-PROD-004: Chọn Danh Mục & Phân Loại**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Admin |
| **Đầu vào** | Product ID, Primary category, Tags (trending, bestseller, seasonal) |
| **Xử lý** | Update category, re-score product dựa trên danh mục |
| **Đầu ra** | Product categorized |
| **Note** | Danh mục định sẵn: Shirts, Shorts, Socks, Accessories, etc |

---

## 2. AI Product Scoring & Intelligence

### 2.1. Product Scoring Engine

**FR-AI-PROD-001: Tính Điểm Cơ Hội Sản Phẩm**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | System trigger (khi thêm product, hằng ngày) |
| **Đầu vào** | Product data (name, category, price, supplier data) |
| **AI Model** | Gemini Flash hoặc Qwen3 (quick inference) |
| **Scoring Formula** | <br> Demand Score (0-25): tìm kiếm thị trường <br> Competition Score (0-20): số lượng cạnh tranh <br> Profit Margin Score (0-25): (sell_price - cost) / sell_price <br> Content Viability (0-15): dễ quay video, tạo ảnh <br> Risk Score (0-15): return rate, QA risk <br> **Total: 0-100** |
| **Đầu ra** | Product score, scoring breakdown, recommendation (high/medium/low opportunity) |
| **Refresh** | Hằng ngày lúc 0h, khi sản phẩm được cập nhật |

**FR-AI-PROD-002: Top Sản Phẩm Khuyến Nghị**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Admin / Marketing |
| **Đầu vào** | Category, sort by (score, potential_revenue, newest) |
| **Xử lý** | Retrieve top 20 products by score, filter by category |
| **Đầu ra** | Ranked product list (name, score, margin, reason) |
| **Dashboard** | Widget "Top Opportunities" trên executive dashboard |

---

## 3. AI Content Generation

### 3.1. Tạo Nội Dung Bán Hàng

**FR-CONTENT-001: Tạo Mô Tả Sản Phẩm**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Operator / Content AI (auto-trigger) |
| **Đầu vào** | Product ID, target platform (Shopee/TikTok/Website) |
| **AI Model** | Qwen3 (cost-effective for long content) |
| **Prompt Template** | <br> "Viết mô tả sản phẩm [name] cho [category]. <br> Giá bán: [price], Lợi nhuận: [margin]%. <br> Điểm mạnh: [unique_features]. <br> USP: [value_proposition]. <br> Tone: friendly, conversational, CTA rõ ràng." |
| **Output** | Description (200-300 words), includes size guide, care instructions |
| **Version** | Tạo 3 phiên bản → user chọn 1 hoặc edit |

**FR-CONTENT-002: Tạo Caption Mạng Xã Hội**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Content AI (auto) |
| **Đầu vào** | Product ID, Post type (carousel, reel, static), Vibe (playful/aspirational/educational) |
| **AI Model** | Gemini Flash (nhanh, cost-effective) |
| **Output** | Caption 100-150 chars (Insta), 150-200 chars (TikTok), with emojis + hashtags |
| **A/B Testing** | Tạo 3 variations → measure engagement |

**FR-CONTENT-003: Tạo Video Script / Content Outline**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Content AI (auto) |
| **Đầu vào** | Product ID, Video type (unboxing, try-on, tutorial, testimonial) |
| **AI Model** | Qwen3 |
| **Output** | <br> Video script (scene by scene, duration, talking points) <br> Props needed, Filming location tips, Music mood |
| **Length** | 15-30 second format (TikTok/Reels optimized) |

**FR-CONTENT-004: Quản Lý Content Calendar**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Marketing / Admin |
| **Chức năng** | <br> - View calendar (daily/weekly view) <br> - Schedule posts (bulk scheduling) <br> - Approve/reject content <br> - Publish to channels (Facebook, TikTok, Website) <br> - Track engagement (comments, shares, saves) |
| **Content Status** | Draft → In Review → Approved → Published → Completed |
| **Approval Flow** | Admin → Marketing Lead → Post |

---

## 4. AI Sales & Customer Communication

### 4.1. Sales Script & FAQ Generation

**FR-SALES-001: Tạo Kịch Bản Trả Lời Khách**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Sales AI (auto) |
| **Đầu vào** | Product ID, Customer concern type (size, quality, price, delivery time) |
| **AI Model** | Gemini Flash + knowledge base (FAQ, policy) |
| **Output** | 3-4 response scripts, customized by concern |
| **Example** | <br> **Concern:** "Có size M không?" <br> **Response 1:** "Em có size M ạ. Em có thể check hàng có sẵn không?" <br> **Response 2:** "Chị ơi, em vừa kiểm tra, size M còn 5 cái. Chị có muốn mua không ạ?" |

**FR-SALES-002: FAQ Knowledge Base**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Admin (tạo FAQ), Sales AI (dùng) |
| **Chức năng** | <br> - Create/Edit FAQ items (Q, A, category) <br> - FAQ categories: Size Guide, Shipping, Return, Payment, Quality <br> - Vector search (AI lookup similar Q) <br> - Update frequency: hằng tuần |
| **Storage** | PostgreSQL + pgvector (embedding) |

**FR-SALES-003: Sales Assistant Chatbot (MVP)**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Trigger** | Customer message on Facebook/Zalo/Website |
| **AI Model** | Gemini Flash (fast response < 2s) |
| **Context** | Product info, inventory, customer history (if returning), FAQ |
| **Guardrails** | <br> - Không cam kết không đủ thông tin (redirect human) <br> - Không promise giảm giá ngoài chính sách <br> - Log toàn bộ conversation |
| **Escalation** | Auto escalate → Human nếu customer negative sentiment |
| **Response Time** | Target: < 3 seconds |

---

## 5. Quản Lý Đơn Hàng

### 5.1. Order Management

**FR-ORDER-001: Tạo Đơn Hàng**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Sales AI / Operator / Customer (web) |
| **Đầu vào** | Product variant ID, Quantity, Customer info (name, phone, address), Payment method |
| **Xử lý** | <br> - Validate stock <br> - Validate customer info <br> - Generate order ID (format: ORD-YYYYMMDD-XXXXX) <br> - Create draft order (status: PENDING) |
| **Đầu ra** | Order created, confirmation message |
| **Validation** | Stock > 0, customer info complete, quantity > 0 |

**FR-ORDER-002: Xác Nhận & Đóng Gói Đơn**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Fulfillment AI / Operator |
| **Đầu vào** | Order ID |
| **Xử lý** | <br> - Check payment confirmed <br> - Reserve stock <br> - Deduct inventory <br> - Generate packing list <br> - Update status: CONFIRMED |
| **Đầu ra** | Order packed, ready for shipping |

**FR-ORDER-003: Tạo Vận Đơn & Giao Hàng**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Fulfillment AI / Shipping partner |
| **Đầu vào** | Order ID, Shipping method (GHN/Giao Hàng Nhanh/J&T), Receiver address |
| **Xử lý** | <br> - Call shipping API (integration) <br> - Generate tracking number <br> - Send tracking link to customer (SMS/Email) <br> - Update order status: SHIPPED |
| **Đầu ra** | Shipment created, tracking number, notification sent |

**FR-ORDER-004: Theo Dõi Trạng Thái Đơn Hàng**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Customer / Admin |
| **Chức năng** | <br> - View order status (timeline) <br> - Tracking link <br> - Estimated delivery date <br> - Contact support button |
| **Statuses** | PENDING → CONFIRMED → PACKED → SHIPPED → DELIVERED → COMPLETED / RETURNED |

**FR-ORDER-005: Xử Lý Hoàn Hàng & Hoàn Tiền**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Customer / Admin |
| **Trigger** | Customer request return |
| **Xử lý** | <br> - Verify return reason (quality, wrong size, not as described) <br> - Generate return label <br> - Track return shipment <br> - Inspect returned item <br> - Approve/reject refund <br> - Process refund (back to customer account) |
| **Policy** | Hoàn lại trong 7 ngày, chưa sử dụng |

---

## 6. Quản Lý Khách Hàng

### 6.1. Customer Management

**FR-CUST-001: Tạo & Cập Nhật Profil Khách Hàng**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | System (auto), Customer (self-update) |
| **Dữ liệu** | Name, Phone, Email, Address, Preferred size, Preferences |
| **Chức năng** | <br> - Auto-create on first purchase <br> - Merge duplicate profiles <br> - Customer self-service profile edit |

**FR-CUST-002: Lịch Sử Mua Hàng & Phân Tích**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Admin / BI AI |
| **Chức năng** | <br> - View customer purchase history <br> - Lifetime value (LTV) <br> - Repeat purchase rate <br> - Segment: VIP, Regular, At-risk, Churned |
| **Dashboard** | Customer intelligence (top customers, LTV ranking) |

**FR-CUST-003: Customer Segmentation (AI)**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Trigger** | Hằng tuần (automatic) |
| **AI Model** | Gemini Flash + Python/SQL (clustering) |
| **Segmentation Logic** | <br> - VIP: LTV > $500, repeat rate > 50% <br> - Regular: LTV $100-500, repeat rate 20-50% <br> - New: < 3 purchases <br> - At-risk: 30+ days inactive <br> - Churned: 90+ days inactive |
| **Output** | Customer segments, targeting recommendations |

---

## 7. Dashboard & Báo Cáo

### 7.1. Executive Dashboard

**FR-DASH-001: Dashboard Tổng Quan (Executive)**

| Metric | Chi tiết |
|--------|----------|
| **Revenue** | Today, This week, This month (vs last period) |
| **Profit** | Total profit, Profit margin %, ROAS |
| **Orders** | New orders (24h), Completed, Pending, Failed |
| **Products** | Total products, Active products, Top 5 by sales |
| **Inventory** | Total stock value, Low stock alerts, Out of stock |
| **Customers** | New customers (24h), Repeat rate, Average LTV |
| **Visualizations** | Revenue trend (line chart), Product performance (pie chart), Customer segments (bar chart) |

**FR-DASH-002: Product Intelligence Dashboard**

| Metric | Chi tiết |
|--------|----------|
| **Product Score** | Top 10 products by score, score breakdown |
| **Sales Performance** | Units sold, Revenue per product, Conversion rate |
| **Profitability** | Cost, Selling price, Margin, Margin % |
| **Inventory Health** | Stock level, Stock turnover, Days to sell out |
| **Recommendation** | Products to discontinue, products to push |

**FR-DASH-003: Marketing & Content Dashboard**

| Metric | Chi tiết |
|--------|----------|
| **Content Calendar** | Upcoming posts, scheduled dates, status |
| **Engagement** | Total reach, engagement rate, top performing posts |
| **Channels** | Performance by channel (Facebook vs TikTok vs Website) |
| **AI Cost** | Content generation cost (tokens used), cost per post |

**FR-DASH-004: Sales & Customer Dashboard**

| Metric | Chi tiết |
|--------|----------|
| **Lead Pipeline** | New leads, qualified leads, converted (this week) |
| **Response Time** | Average response time (Sales AI), customer satisfaction |
| **Conversion** | Lead to order rate, average order value |
| **Customer Insights** | Top customers, repeat rate, churn rate |

**FR-DASH-005: AI Cost Tracking Dashboard**

| Metric | Chi tiết |
|--------|----------|
| **Total Cost** | Daily/weekly/monthly AI spend |
| **Cost by Agent** | Content AI, Sales AI, Product AI, BI AI, etc |
| **Cost by Model** | Gemini Flash, Qwen, Claude, GPT-5 (breakdown) |
| **Efficiency** | Cost per order, cost per lead, token efficiency |
| **Alerts** | Trigger alert nếu daily cost > threshold |

**FR-DASH-006: Real-time Notifications**

| Event | Notification |
|-------|--------------|
| New order | "New order #123 từ [customer]. $[amount]" |
| Payment received | Confirmation + order confirmation email |
| Stock low | "Product [name] stock < 5 units" |
| AI error | "Content AI failed for product #456. Manual review needed." |
| High ROAS | "Campaign A achieved 5.2x ROAS!" |

---

## 8. Kết Hợp & Tích Hợp

### 8.1. Authentication & Authorization

**FR-AUTH-001: Đăng Ký & Đăng Nhập**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Methods** | Email/password (MVP), Google OAuth (Phase 2) |
| **Password** | Min 8 chars, 1 uppercase, 1 number, 1 special char |
| **JWT Token** | Access token (15 min) + Refresh token (7 days) |
| **Session** | httpOnly cookies (security) |

**FR-AUTH-002: Role-Based Access Control (RBAC)**

| Role | Permissions |
|------|------------|
| **Admin** | Full access: all modules, settings, user management |
| **Manager** | View all, approve content, manage products, view analytics |
| **Operator** | Create/edit products, manage orders, respond to customers |
| **Viewer** | Read-only access (dashboards, analytics) |

### 8.2. File Management

**FR-FILE-001: Upload & Store Media**

| Yêu cầu | Chi tiết |
|---------|----------|
| **Người dùng** | Operator / Admin |
| **File Types** | Images (JPG, PNG, WebP), Videos (MP4, WebM) |
| **Storage** | S3-compatible (AWS S3 / Cloudflare R2 / MinIO) |
| **Optimization** | Auto resize images, generate thumbnails |
| **Limits** | 10MB per image, 100MB per video |

### 8.3. External Integrations

**FR-INTEG-001: Marketplace Integration (Phase 2+)**

| Platform | Status (MVP) | Future |
|----------|------------|--------|
| **Shopee API** | Manual export | Auto sync products/orders |
| **TikTok Shop** | Manual export | Auto sync products/orders |
| **Facebook** | Manual posting | Auto post via n8n |
| **Zalo** | Manual (OA) | Bot integration |

---

## 9. Non-Functional Requirements

### 9.1. Performance

| Requirement | Target |
|------------|--------|
| API Response Time | < 500ms (p95) |
| Dashboard Load Time | < 2s |
| AI Model Inference | < 3s (chat), < 30s (content generation) |
| Database Query | < 100ms (p95) |
| Concurrent Users | 100+ (MVP) |

### 9.2. Security

- All API endpoints require authentication
- HTTPS/TLS 1.3 enforced
- Rate limiting: 100 requests/minute per user
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- CSRF protection on forms
- XSS prevention (escape all user inputs)

### 9.3. Availability

- Uptime target: 99.5% (MVP) → 99.9% (Phase 2+)
- Database backup: daily, 30-day retention
- Disaster recovery: documented, tested quarterly
- Graceful degradation (if AI API down, show cached results)

### 9.4. Scalability

- Stateless API (easy horizontal scaling)
- Database connection pooling
- Caching strategy (Redis) for Phase 2
- CDN for static assets (Phase 2)
- Batch processing for bulk operations (Phase 2)

---

## 10. MVP Scope & Out of Scope

### 10.1. Termasuk dalam MVP

- ✅ Product management (CRUD, variants, inventory)
- ✅ Product AI scoring
- ✅ Content AI (captions, descriptions, scripts)
- ✅ Sales script & FAQ AI
- ✅ Basic order management
- ✅ Customer profiles
- ✅ Dashboards (executive, product, marketing, sales, AI cost)
- ✅ Authentication & authorization
- ✅ File upload & storage
- ✅ Admin panel

### 10.2. Tidak Termasuk MVP (Phase 2+)

- ❌ Marketplace auto-integration (Shopee/TikTok API sync)
- ❌ Auto ad campaign creation & bidding
- ❌ Auto supplier ordering
- ❌ Advanced analytics & predictive models
- ❌ Mobile app (web-responsive only)
- ❌ Multi-language support
- ❌ Warehouse management system
- ❌ Advanced reporting (custom reports)
- ❌ Integration marketplace (API for third parties)

---

## 11. Acceptance Criteria & Testing Checklist

### 11.1. Product Features

- [ ] Create product with all required fields
- [ ] Upload product images (min 3, max 10)
- [ ] Create product variants (size × color)
- [ ] Update inventory (manually + via import)
- [ ] Product AI score calculates correctly
- [ ] View products in list & detail view

### 11.2. Content Features

- [ ] Content AI generates description
- [ ] Content AI generates captions (3 variations)
- [ ] Content AI generates video scripts
- [ ] Content calendar displays correctly
- [ ] Schedule posts for future dates
- [ ] Approve/reject content

### 11.3. Sales Features

- [ ] Sales AI responds to customer questions
- [ ] FAQ knowledge base functional
- [ ] Create order via dashboard
- [ ] Customer can purchase on landing page (MVP)

### 11.4. Order Management

- [ ] Create order, status = PENDING
- [ ] Confirm order, reserve stock, deduct inventory
- [ ] Generate shipping label
- [ ] Track order status
- [ ] Handle return requests

### 11.5. Dashboards

- [ ] Executive dashboard shows correct KPIs
- [ ] Product dashboard shows scores & rankings
- [ ] Marketing dashboard shows content calendar
- [ ] Sales dashboard shows conversion metrics
- [ ] AI cost dashboard tracks spending

### 11.6. Security & Auth

- [ ] User login/logout works
- [ ] JWT token expires & refreshes
- [ ] Role-based access control enforced
- [ ] API endpoints require authentication
- [ ] Sensitive data not logged

### 11.7. Performance

- [ ] API response < 500ms
- [ ] AI inference < 3s
- [ ] Dashboard loads < 2s
- [ ] Handle 50+ concurrent users

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Final |
| Last Updated | 27/06/2026 |
| Owner | Product Team |
| Next Review | After Phase 1 sprint completion |

---

**Tiếp theo:** Tham khảo Database Schema & API Specification cho chi tiết kỹ thuật.
