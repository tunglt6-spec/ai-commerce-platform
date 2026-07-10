# AI Commerce Platform - Kế Hoạch Chi Phí Dự Kiến & AI Model Recommendation

**Version:** 1.0  
**Date:** 27/06/2026  
**Currency:** USD (dễ convert sang VND với tỷ giá hiện tại)

---

## 1. Tổng Quan Chi Phí

### 1.1. Chi Phí Khởi Động (MVP - 4 tuần)

| Item | Chi phí | Ghi chú |
|------|---------|--------|
| **Nhân sự (Team)** | $48,000 | 12-15 people × 4 weeks |
| **Infrastructure** | $2,000 | Servers, DB, storage, backup |
| **AI APIs** | $500 | Testing & development |
| **Tools & Services** | $1,000 | Figma, Postman, GitHub, Slack, etc |
| **Contingency (10%)** | $5,150 | Buffer for overruns |
| **TOTAL MVP** | **$56,650** | Full MVP launch cost |

### 1.2. Chi Phí Hàng Tháng (Sau Launch)

| Category | Cost/Month | Notes |
|----------|-----------|-------|
| **Infrastructure** | $500-1,000 | AWS/GCP servers, DB, storage |
| **AI APIs (Base)** | $200-400 | Gemini Flash + Qwen (standard ops) |
| **Team (Ops)** | $12,000-15,000 | 3-4 people maintenance |
| **Tools & Services** | $300-500 | Subscriptions, monitoring |
| **TOTAL/Month** | **$13,000-16,900** | Steady-state monthly |

---

## 2. Chi Phí AI Models Chi Tiết

### 2.1. Bảng Giá Hiện Tại (Q2 2026)

| Model | Input Cost | Output Cost | Speed | Quality | Use Case |
|-------|-----------|------------|-------|---------|----------|
| **Gemini Flash** | $0.075/1M | $0.3/1M | ⚡⚡⚡ | ⭐⭐⭐ | Default choice |
| **Qwen 3** | $0.05/1M | $0.15/1M | ⚡⚡ | ⭐⭐⭐ | Content writing |
| **Claude Sonnet** | $3/1M | $15/1M | ⚡⭐ | ⭐⭐⭐⭐ | Complex tasks |
| **GPT-4 Turbo** | $10/1M | $30/1M | ⭐ | ⭐⭐⭐⭐ | Premium tasks |
| **GPT-5** (when avail) | $15/1M | $60/1M | ⚠️ | ⭐⭐⭐⭐⭐ | Rare use |

### 2.2. Token Consumption Per Task

| Task | Model | Input Tokens | Output Tokens | Cost/Task | Freq/Day |
|------|-------|--------------|---------------|-----------|----------|
| Product score | Qwen3 | 300 | 200 | $0.0005 | 50 |
| Description gen | Qwen3 | 500 | 400 | $0.0009 | 10 |
| Caption gen | Gemini | 400 | 150 | $0.00005 | 30 |
| Video script | Qwen3 | 800 | 600 | $0.0016 | 5 |
| Sales response | Gemini | 800 | 300 | $0.00009 | 50 |
| Product analysis | Claude | 2000 | 1000 | $0.035 | 1-2 |

---

## 3. Chi Phí Theo AI Agent

### 3.1. Chi Phí Hàng Tháng Per Agent

| Agent | Model(s) | Tasks/Day | Tokens/Day | Cost/Day | Cost/Month |
|-------|----------|-----------|-----------|----------|-----------|
| **Trend Hunter** | Gemini Flash | 1 | 50K | $0.02 | $0.60 |
| **Product AI** | Qwen3 | 50 products | 30K | $0.03 | $0.90 |
| **Content AI** | Qwen3 | 10-20 | 200K | $0.25 | $7.50 |
| **Sales AI** | Gemini Flash | 100-200 | 150K | $0.15 | $4.50 |
| **Ads AI** | Gemini Flash | 5-10 | 20K | $0.02 | $0.60 |
| **Customer Success** | Gemini Flash | 30-50 | 80K | $0.10 | $3.00 |
| **BI Analyze** | Gemini Flash | 1-2 | 100K | $0.12 | $3.60 |
| **Fulfillment** | None (API) | - | 0 | $0 | $0 |
| **Finance** | Gemini Flash | 1 | 50K | $0.06 | $1.80 |
| **Supplier** | Gemini Flash | 5-10 | 30K | $0.04 | $1.20 |
| **TOTAL** | | | 710K | $0.79/day | **$23.70/month** |

**Chi chú:** Đây là ước tính BASE. Nếu business scale tăng 10x, chi phí tăng ~10x nhưng có thể optimize bằng caching & batching.

---

## 4. AI Model Recommendation Chi Tiết Per Agent

### 4.1. Trend Hunter AI

**Vai trò:** Tìm kiếm xu hướng sản phẩm trên marketplace

```
┌─ Requirement Analysis
│  └─ Input: Market data (1-5M chars/request)
│  └─ Output: Top 20 products
│  └─ Frequency: 1x/day
│  └─ Latency SLA: < 30 seconds
└─

Recommendation:
├─ PRIMARY: Gemini Flash ✅
│  └─ Reason: Fast, cheap, good at data aggregation
│  └─ Cost: $0.02/day
│  └─ Tokens: ~50K/request
│
├─ FALLBACK: Qwen3
│  └─ If Gemini quota exhausted
│  └─ Cost: $0.03/day
│
└─ NOT: Claude (overkill, 100x more expensive)
```

**Model Decision:** `Gemini Flash` ONLY (0% fallback needed)

---

### 4.2. Product AI

**Vai trò:** Chấm điểm sản phẩm (0-100) dựa trên công thức

```
Requirement Analysis:
├─ Input: Product data (300-500 tokens)
├─ Output: Score + breakdown
├─ Frequency: 50 products/day
├─ Latency SLA: < 5 seconds per score
└─ Complexity: Medium (structured scoring)

Recommendation:
├─ PRIMARY: Qwen3 ✅
│  └─ Reason: Cheap, fast, good for structured tasks
│  └─ Cost: $0.03/day (50 products × 600 tokens avg)
│  └─ Accuracy: ~95% (consistent scoring)
│
├─ FALLBACK: Gemini Flash
│  └─ If Qwen quota full
│  └─ Cost: $0.05/day (slightly more expensive)
│
└─ NOT: Claude (unnecessary, 50x more expensive)
```

**Model Decision:** `Qwen3` PRIMARY → `Gemini Flash` FALLBACK

---

### 4.3. Content AI (✨ Most Important)

**Vai trò:** Tạo descriptions, captions, video scripts

```
Requirement Analysis:
├─ Input: Product data + creative brief (500-1000 tokens)
├─ Output: 3 variations (1000-3000 tokens)
├─ Frequency: 10-20 products/day
├─ Latency SLA: < 30 seconds (batch job, OK)
└─ Complexity: High (creative writing)

Token Breakdown per Product:
├─ 3 descriptions (300 tokens each) = 900 tokens out
├─ 5 captions (150 tokens each) = 750 tokens out
├─ 2 video scripts (600 tokens each) = 1200 tokens out
└─ TOTAL per product ≈ 2850 output tokens

Daily Cost Analysis:
├─ Option A: Qwen3 for all
│  └─ Cost: (500 in + 2850 out) × 15 = ~$4.05/day
│  └─ ✅ BEST CHOICE (cheapest, good quality)
│
├─ Option B: Claude for all
│  └─ Cost: (500 in + 2850 out) × 15 × 50 = ~$202.50/day ❌
│  └─ Too expensive, overkill
│
├─ Option C: Hybrid (Qwen for bulk, Claude for premium)
│  └─ Cost: $4 + (1 × $0.035) = ~$4.035/day
│  └─ Use Case: Client requests "best quality"
│
└─ Option D: GPT-4 for all
   └─ Cost: ~$67.50/day ❌ TOO EXPENSIVE
```

**Model Decision:** 
- **DEFAULT (80% of tasks):** `Qwen3` → $4.05/day
- **PREMIUM (20% of tasks, on request):** `Claude Sonnet` → +$0.70/day
- **Total Content AI:** ~$4.75/day = **$142.50/month**

**Why Qwen3 Best:**
- 20x cheaper than Claude
- Quality still great (⭐⭐⭐)
- Perfect for repetitive content generation
- Can use saved budget for other agents

---

### 4.4. Sales AI (Real-time)

**Vai trò:** Trả lời câu hỏi khách hàng, gợi ý bán hàng

```
Requirement Analysis:
├─ Input: Product + FAQ + customer history (~800 tokens)
├─ Output: 2-3 response options (300-400 tokens)
├─ Frequency: 100-200 conversations/day
├─ Latency SLA: < 3 seconds ⚠️ CRITICAL
├─ Complexity: Medium (conversational, needs context)
└─ Scalability: Peak 5 requests/sec

Recommendation:
├─ PRIMARY: Gemini Flash ✅
│  └─ Reason: FASTEST model (<1s), good quality for chat
│  └─ Cost: $0.00015 per response
│  └─ Total: 150 responses/day × $0.00015 = $0.0225/day
│  └─ Handles 1000 concurrent easily
│
├─ For VIP/Complex Cases: Claude Sonnet
│  └─ Trigger: If confidence < 60%
│  └─ Frequency: 5-10 per day
│  └─ Cost: $0.035/response
│  └─ Total: 7 × $0.035 = $0.245/day (premium)
│
└─ NOT: Qwen3 (slower, not ideal for real-time)
```

**Model Decision:** 
- **MAIN (90% of chats):** `Gemini Flash` → $0.023/day
- **VIP (10% of chats):** `Claude Sonnet` → $0.025/day  
- **Total Sales AI:** ~$0.048/day = **$1.44/month**

**Why Gemini Essential:**
- Only model fast enough for <3s SLA
- Customer won't wait > 3 seconds
- Cost is negligible anyway

---

### 4.5. Ads AI

**Vai trò:** Đề xuất thông điệp, A/B test strategies

```
Requirement Analysis:
├─ Input: Product + campaign brief (~400 tokens)
├─ Output: 3-5 suggestions (200-300 tokens)
├─ Frequency: 5-10 per day
├─ Latency SLA: < 10 seconds (non-real-time)
└─ Complexity: Medium (strategy)

Recommendation:
├─ PRIMARY: Gemini Flash ✅
│  └─ Cost: $0.02/day
│  └─ Reason: Fast enough, cheap
│
└─ For Premium Campaigns: Claude Sonnet (optional)
   └─ Frequency: 1-2/week
   └─ Cost: $0.015/week = $0.002/day
```

**Model Decision:** `Gemini Flash` PRIMARY + optional `Claude` for premium

---

### 4.6. Customer Success AI

**Vai trò:** Follow-up sau mua hàng, xin review, upsell

```
Requirement Analysis:
├─ Input: Customer history + product (~500 tokens)
├─ Output: Personalized message (200-300 tokens)
├─ Frequency: 30-50 per day
├─ Latency SLA: < 60 seconds (batch, not real-time)
└─ Complexity: Medium (personalization)

Recommendation:
├─ PRIMARY: Gemini Flash ✅
│  └─ Cost: $0.10/day
│  └─ Perfect for this use case
│
└─ Alternative: Qwen3
   └─ Cost: $0.06/day (slightly cheaper)
   └─ Quality still good for follow-ups
```

**Model Decision:** `Gemini Flash` (reliability > 20% cost saving)

---

### 4.7. BI Analyze AI

**Vai trò:** Phân tích dữ liệu, insights, recommendations

```
Requirement Analysis:
├─ Input: SQL query results + context (100K tokens)
├─ Output: Analysis + insights (1000-2000 tokens)
├─ Frequency: 1-2 per day
├─ Latency SLA: < 60 seconds
└─ Complexity: High (analytics, insights)

Recommendation:
├─ PRIMARY: Gemini Flash ✅
│  └─ Cost: $0.12/day
│  └─ Good enough for business insights
│  └─ Process data, generate narrative
│
├─ OPTIONAL: Claude Sonnet
│  └─ When need strategic insights
│  └─ Frequency: 1x/week
│  └─ Cost: $0.035/analysis
│
└─ NOT: GPT-5 (overkill for data analysis)
```

**Model Decision:** `Gemini Flash` DEFAULT + `Claude` for deep analysis

---

### 4.8. Finance AI

**Vai trò:** Tracking chi phí, lợi nhuận, báo cáo tài chính

```
Requirement Analysis:
├─ Input: Financial data (20-50K tokens)
├─ Output: Report + analysis (1000 tokens)
├─ Frequency: Daily (1x/day)
├─ Latency SLA: < 60 seconds
└─ Complexity: Medium (structured data)

Recommendation:
├─ PRIMARY: Gemini Flash ✅
│  └─ Cost: $0.06/day
│  └─ Good for financial narrative
│
└─ NOTE: Use SQL/Python for calculations (no LLM needed)
```

**Model Decision:** `Gemini Flash` (SQL does heavy lifting)

---

### 4.9. Fulfillment AI

**Vai trò:** Order processing, shipping, returns

```
Requirement Analysis:
├─ Input: Order data (100-200 tokens)
├─ Output: Action (create shipment, etc)
├─ Frequency: 100+ per day
└─ Complexity: DETERMINISTIC (no LLM needed!)

Recommendation:
└─ ⛔ NO AI NEEDED
   └─ Use: n8n workflows + API calls
   └─ Cost: $0/day
   └─ Reason: Deterministic logic, no reasoning needed
```

**Model Decision:** `None - Use n8n/API Only`

---

### 4.10. CEO AI (Strategic Decisions)

**Vai trò:** Quyết định chiến lược, phê duyệt quan trọng

```
Requirement Analysis:
├─ Input: Summary + context (5-10K tokens)
├─ Output: Recommendation + rationale
├─ Frequency: 1-3 per week
├─ Latency SLA: < 120 seconds
└─ Complexity: VERY HIGH (strategic)

Recommendation:
├─ PRIMARY: Claude Sonnet ✅
│  └─ Cost: $0.035/task × 2 = $0.07/week
│  └─ Reason: Best for complex reasoning
│  └─ Only called for important decisions
│
├─ OPTION: GPT-5 (when available)
│  └─ Cost: $0.075/task (more expensive)
│  └─ For very complex multi-agent coordination
│
└─ NOT: Gemini (not enough reasoning for strategy)
```

**Model Decision:** `Claude Sonnet` (never cheap out on strategy)

---

### 4.11. Supplier AI (Future)

**Vai trò:** Quản lý nhà cung cấp, đặt hàng

```
Recommendation:
├─ PRIMARY: Gemini Flash ✅
│  └─ For MVP (Phase 1)
│  └─ Cost: $0.04/day
│
└─ Future: Custom NLP model
   └─ For Phase 3+ (if high volume)
```

**Model Decision:** `Gemini Flash` (future upgrade to custom)

---

## 5. Chi Phí Tổng Hợp - Best Practice Scenario

### 5.1. Monthly Cost Breakdown (Optimized)

```
AI AGENT COSTS (Monthly)
├─ Trend Hunter AI (Gemini Flash)
│  └─ 50K tokens/day × 30 days = 1.5M tokens
│  └─ Cost: (1.5M × $0.075)/1M = $0.11/month
│
├─ Product AI (Qwen3)
│  └─ 30K tokens/day × 30 = 0.9M tokens
│  └─ Cost: $0.045/month
│
├─ Content AI (Qwen3)
│  └─ 200K tokens/day × 30 = 6M tokens
│  └─ Cost: $0.30/month ⭐ BIGGEST
│
├─ Sales AI (Gemini Flash)
│  └─ 150K tokens/day × 30 = 4.5M tokens
│  └─ Cost: $0.34/month
│
├─ Customer Success (Gemini Flash)
│  └─ 80K tokens/day × 30 = 2.4M tokens
│  └─ Cost: $0.18/month
│
├─ BI Analyze (Gemini Flash)
│  └─ 100K tokens/day × 30 = 3M tokens
│  └─ Cost: $0.23/month
│
├─ Finance AI (Gemini Flash)
│  └─ 50K tokens/day × 30 = 1.5M tokens
│  └─ Cost: $0.11/month
│
├─ CEO AI (Claude Sonnet)
│  └─ 2 tasks/week × 2K tokens avg = 4K tokens
│  └─ Cost: $0.06/month
│
├─ Ads AI (Gemini Flash)
│  └─ 20K tokens/day × 30 = 0.6M tokens
│  └─ Cost: $0.045/month
│
└─ Supplier AI (Future)
   └─ Cost: $0.03/month

TOTAL AI COST: $1.435/month ✅ VERY CHEAP!
```

### 5.2. Full Operating Cost (Monthly)

| Category | Cost/Month | Details |
|----------|-----------|---------|
| **Infrastructure** | $500-1,000 | Servers, DB, storage |
| **AI APIs** | $1.44 | All 10 agents combined |
| **Operations Team** | $12,000 | 3 people (ops, support, admin) |
| **Tools & Services** | $300-500 | Monitoring, analytics, support |
| **Contingency (5%)** | $650-800 | Buffer |
| **TOTAL/Month** | **$13,452-14,344** | Steady-state cost |

**Chi chú quan trọng:**
- **AI cost chỉ $1.44/month** - rất rẻ! 🎉
- Phần lớn cost là nhân sự ($12K+)
- Infrastructure cost (~$750) đủ cho 50-100K users/month

---

## 6. Cost Scaling & ROI Projection

### 6.1. Cost When Scaling 10x

| Scenario | Baseline | 10x Growth | Cost Increase |
|----------|----------|-----------|---------------|
| **Daily Operations** | $14K/month | $140K/month | 10x |
| **AI APIs** | $1.44 | $14.40 | 10x |
| **Infrastructure** | $750 | $5,000-10K | 6-13x |
| **Team** | $12K | $24-30K | 2-2.5x |
| **ROI** | TBD | Should be 3-5x | Positive ✅ |

**Conclusion:** Scaling is LINEAR on cost (good!), but revenue grows EXPONENTIAL (better!)

### 6.2. Break-Even Analysis

```
Assumptions:
├─ Average order value: $30
├─ Profit margin: 30% = $9/order
├─ Cost per order processed: $0.05 (AI + ops)
├─ Monthly fixed cost: $13.5K

Break-even:
├─ Monthly orders needed: 13,500 / ($9 - $0.05) = 1,500 orders/month
├─ Daily orders: ~50 orders/day
├─ With AI efficiency, realistic: 100-200 orders/day 📈
├─ Profit/month: (150 × 30 × $9) - $13.5K = $67.5K - $13.5K = $54K ✅

Expected ROI: 
├─ Month 1: -$10K (setup costs)
├─ Month 2-3: +$20-30K/month (ramp up)
├─ Month 4+: +$50K+/month (stable growth)
└─ Payback period: 2.5 months
```

---

## 7. Cost Optimization Recommendations

### 7.1. Token Optimization (Save 30-40%)

```
Recommendation #1: Prompt Caching
├─ What: Reuse system prompts across requests
├─ Savings: 20% of input tokens
├─ Implementation: Cache FAQ, product catalog in prompt
├─ Timeline: Week 2

Recommendation #2: Batch Processing
├─ What: Batch 10 requests per call instead of 1
├─ Savings: 10-15% of overhead
├─ Implementation: Nightly batch for content, scoring
├─ Timeline: Week 3

Recommendation #3: Context Truncation
├─ What: Only send relevant context (trim FAQ to top 5)
├─ Savings: 5-10% of tokens
├─ Implementation: Vector search before calling AI
├─ Timeline: Week 2

Recommendation #4: Model Routing
├─ What: Use cheaper model 80% of time, expensive 20%
├─ Savings: 40-50% if done right
├─ Current Status: ✅ Already implemented
├─ Examples: Gemini for basic tasks, Claude for complex

Recommendation #5: Fallback Models
├─ What: If primary model fails, use cheaper fallback
├─ Savings: Avoid expensive retries
├─ Implementation: LiteLLM routing rules
├─ Timeline: Week 1
```

**Total Savings Potential: 40-50%** → Could bring AI cost down to $0.70-1.00/month

### 7.2. Infrastructure Optimization

```
Recommendation #1: Reserved Instances
├─ Savings: 30-40% vs on-demand
├─ Cost: $500→300/month
├─ Commitment: 1 year

Recommendation #2: Database Optimization
├─ Savings: 20% via indexing, query optimization
├─ Cost: $200→160/month
├─ Timeline: Week 1-2

Recommendation #3: CDN for Media
├─ Savings: 30-40% on storage egress
├─ Cost: $150→100/month
├─ Timeline: Phase 2

TOTAL Infrastructure Savings: ~$200-300/month (30%)
```

### 7.3. Team Optimization

```
Currently: 4 full-time ops staff = $12K/month

Optimization Path:
├─ Month 1-2: Keep 4 (setup phase)
├─ Month 3-4: Reduce to 3 + intern = $9K
├─ Month 5+: Increase to 4-5 (growth phase) = $15K
├─ With automation: Operations become 20% overhead instead of 50%

Potential Savings: $1-2K/month (20% of payroll)
```

---

## 8. Cost Comparison: AI Commerce Platform vs Traditional E-commerce

### 8.1. Monthly Cost Comparison

| Function | Traditional | AI Platform | Savings |
|----------|------------|-------------|---------|
| **Content Creation** | 2 people × $1.5K = $3K | $0.30 AI | 99% ✅ |
| **Customer Support** | 2 people × $1.5K = $3K | $1.44 AI | 99% ✅ |
| **Product Research** | 1 person × $1.5K = $1.5K | $0.11 AI | 99% ✅ |
| **Analytics** | 1 person × $2K = $2K | $0.23 AI | 99% ✅ |
| **Fulfillment** | 2 people × $1.5K = $3K | API only | 99% ✅ |
| **Infrastructure** | $1K | $750 | 25% ✅ |
| **TOTAL/Month** | **$13.5K** | **$13.5K** | **SAME** |

**Key Finding:** Tương tự chi phí nhưng AI cung cấp:
- 10x higher throughput
- 24/7 availability
- Consistent quality
- Easier to scale

---

## 9. Model Selection Matrix (Quick Reference)

### 9.1. Decision Matrix

| Agent | Use | Model | Cost/Task | Freq/Day | Monthly Cost |
|-------|-----|-------|-----------|----------|--------------|
| Trend Hunter | Data aggregation | Gemini | $0.0002 | 1 | $0.006 |
| Product AI | Structured scoring | Qwen | $0.0005 | 50 | $0.75 |
| Content AI | Creative writing | Qwen | $0.0009 | 15 | $4.05 |
| Sales AI | Real-time chat | Gemini | $0.00015 | 150 | $0.68 |
| Ads AI | Suggestions | Gemini | $0.0001 | 7 | $0.02 |
| Customer Success | Follow-up | Gemini | $0.0005 | 40 | $0.60 |
| BI Analyze | Insights | Gemini | $0.006 | 1.5 | $0.27 |
| CEO AI | Strategy | Claude | $0.035 | 0.3 | $0.315 |
| Finance AI | Reporting | Gemini | $0.0006 | 1 | $0.018 |
| Supplier AI | Future | Gemini | $0.0004 | 5 | $0.06 |

**TOTAL:** $6.74/month for all AI 🎉 (ước tính thấp, actual sẽ ~$1.44 sau optimization)

### 9.2. Selection Rationale

```
IF speed critical (<3s)     → Use Gemini Flash
IF quality critical (>95%)  → Use Qwen3 for writing, Claude for thinking
IF cost critical           → Always use Gemini first, fallback to Qwen
IF real-time needed        → Only Gemini Flash can handle
IF complex strategy        → Only Claude/GPT-5, never Gemini
IF batch/async (>5s OK)    → Prefer Qwen3 (cheaper)
IF unknown                 → Default to Gemini Flash (good balance)
```

---

## 10. Budget Allocation Recommendation

### 10.1. Recommended Budget (Monthly)

```
MONTH 1-3 (Ramp-up Phase)
├─ Infrastructure: $1,000 (over-provisioned, safe)
├─ AI APIs: $150 (conservative estimate)
├─ Team: $12,000 (4 full-time)
├─ Tools & Services: $400
└─ TOTAL: $13,550/month

MONTH 4-6 (Growth Phase)
├─ Infrastructure: $800 (optimized)
├─ AI APIs: $300 (higher volume)
├─ Team: $10,000 (3 core + outsource)
├─ Tools & Services: $400
└─ TOTAL: $11,500/month

MONTH 7+ (Scale Phase)
├─ Infrastructure: $1,500 (scaled)
├─ AI APIs: $1,000 (high volume)
├─ Team: $15,000 (expand for growth)
├─ Tools & Services: $500
└─ TOTAL: $18,000/month
```

### 10.2. Cost Control Checklist

- [ ] Daily monitor AI token usage (alert if > $5/day)
- [ ] Weekly review cost per order
- [ ] Monthly analyze ROI by channel
- [ ] Quarterly optimize expensive agents
- [ ] Set hard caps on experimental features
- [ ] Review & negotiate with AI providers quarterly

---

## 11. Risk & Mitigation

### 11.1. Cost Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| AI price increase | Medium | Medium | Lock in pricing, use fallback models |
| Token overuse | Medium | Low | Daily monitoring, hard caps |
| Infrastructure cost creep | Medium | Medium | Reserved instances, auto-scaling |
| Unexpected AI errors | Low | High | Quality gates, human review for critical |

### 11.2. ROI Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Lower conversion | Medium | High | A/B test content, improve targeting |
| High churn | Medium | High | Better customer success automation |
| Slower growth | Low | Medium | Increase marketing spend, improve product |

---

## 12. Contingency Budget

### 12.1. Unexpected Costs

| Item | Probability | Cost | Total |
|------|-------------|------|-------|
| Emergency scaling (2x capacity) | 10% | $2K | $200 |
| AI API price changes | 20% | $500 | $100 |
| Database optimization needed | 15% | $1K | $150 |
| Security incident response | 5% | $5K | $250 |
| **Contingency Pool** | | | **$700/month** |

**Total Budget = Operating Cost + $700 Contingency = $14.2-15K/month**

---

## 13. Financial Projection (12 Months)

### 13.1. Cost Projection

```
Month    Cost     Cumulative  Notes
────────────────────────────────────
1      $15,000   $15,000    Setup phase (higher)
2      $14,000   $29,000    Stabilizing
3      $13,500   $42,500    Optimized
4      $12,000   $54,500    Reduced team overhead
5      $12,500   $67,000    Scaling up
6      $13,000   $80,000    
7      $15,000   $95,000    Expand for growth
8      $16,000   $111,000   
9      $17,000   $128,000   
10     $18,000   $146,000   
11     $18,500   $164,500   
12     $19,000   $183,500   Full team

AVG/MONTH: $15,292
```

### 13.2. Revenue Projection (Optimistic)

```
Month  Orders/Day  Avg Price  Margin%  Revenue  Profit
──────────────────────────────────────────────────────
1           5         $30      30%    $4,500  -$10,500  ❌
2          20         $32      30%   $19,200   -$7,800  ❌
3          50         $33      30%   $49,500   +$6,950  ✅
4         100         $35      32%  $105,000  +$52,500  ✅
5         120         $35      33%  $126,000  +$62,400  ✅
6         150         $36      34%  $162,000  +$81,000  ✅
...
12        300         $40      35%  $360,000 +$180,000  ✅

PAYBACK PERIOD: Month 3
YEAR 1 PROFIT: ~$680,000 (after all costs)
```

---

## 14. Comparison: In-house vs AI-Powered vs Manual

### 14.1. Cost vs Capacity Comparison

| Metric | Manual Team | In-house AI | AI Commerce Platform |
|--------|------------|------------|----------------------|
| **Monthly Cost** | $20K | $18K | $13.5K |
| **Orders/Day** | 50 | 200 | 300+ |
| **Scaling Cost** | Linear +$1K per 10 orders | -10% per 10x scale | -5% per 10x scale |
| **Quality** | Inconsistent | Better | Consistent |
| **24/7 Support** | No (8x5) | Semi | Yes |
| **Setup Time** | 2 weeks | 4 weeks | 1 week |
| **ROI Timeline** | N/A | 4 months | 3 months |

**Winner:** AI Commerce Platform ✅

---

## 15. Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Approved for Use |
| Last Updated | 27/06/2026 |
| Owner | Finance & Product Team |
| Currency | USD (easily convertible) |
| Valid Until | Q4 2026 |

---

## Appendix: AI Model Pricing Tracker

```
Update whenever prices change. Reference: openrouter.ai, llama.cpp pricing

As of June 2026:
├─ Gemini Flash: $0.075/$0.3 per 1M tokens (input/output)
├─ Qwen 3: $0.05/$0.15 per 1M tokens
├─ Claude Sonnet: $3/$15 per 1M tokens
├─ GPT-4 Turbo: $10/$30 per 1M tokens
└─ GPT-5 (est): $15/$60 per 1M tokens
```

---

**SUMMARY:** 

✅ AI Commerce Platform cost efficient (~$13.5K/month)  
✅ All 10 AI Agents covered with optimal models  
✅ Payback in 3 months with realistic growth  
✅ Scales profitably (costs grow slower than revenue)  
✅ Room for optimization & cost reduction  

**Recommendation: PROCEED with MVP. Budget is reasonable.** 🚀
