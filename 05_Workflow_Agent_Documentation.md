# AI Commerce Platform - Workflow & AI Agent Documentation

**Version:** 1.0  
**Date:** 27/06/2026  
**Status:** Ready for Implementation

---

## 1. AI Agent Architecture

### 1.1. Agent Hierarchy

```
┌─────────────────────────────────┐
│      CEO AI Orchestrator        │
│   (Strategic Decisions)         │
└────────┬────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐  ┌──────────────────────────────┐
│  Human  │  │  AI Agent Dispatcher         │
│ Approval│  │  (Route tasks to agents)     │
└─────────┘  └──────────────┬───────────────┘
                             │
    ┌────────┬───────────┬──┴──┬──────────┬──────────┐
    ▼        ▼           ▼     ▼          ▼          ▼
┌─────┐  ┌────┐  ┌──────┐ ┌───┐  ┌──────┐  ┌───────┐
│Trend│  │Prod│  │Content│ │Ads│  │Sales │  │Fulfill│
│Hunt │  │uct │  │ AI   │ │AI │  │AI    │  │ment   │
└─────┘  └────┘  └──────┘ └───┘  └──────┘  └───────┘
    ▼        ▼           ▼     ▼          ▼          ▼
┌──────────────────────────────────────────────────┐
│     Customer Success AI    |  Finance AI         │
│     BI Analyze AI          |  Supplier AI        │
└──────────────────────────────────────────────────┘
         │
    ┌────┴────────────┐
    ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  Database &  │  │  Knowledge   │
│  Cache       │  │  Base (Vector)
└──────────────┘  └──────────────┘
```

---

## 2. Core Workflow Processes

### 2.1. Product Discovery & Scoring Workflow

**Trigger:** Daily at 0:00 AM OR Manual trigger

**Flow:**

```
┌─────────────────────┐
│  Trend Hunter AI    │
│  (Crawl Marketplace)│
└──────────┬──────────┘
           │
    ┌──────▼──────────────────┐
    │ Data Collection:        │
    │ - Shopee top products   │
    │ - TikTok Shop trending  │
    │ - Google Trends         │
    │ - Search keywords       │
    └──────┬──────────────────┘
           │
┌──────────▼───────────┐
│   Product AI         │
│   (Scoring Engine)   │
└──────────┬───────────┘
           │
    ┌──────▼──────────────────────┐
    │ Calculate Scores:           │
    │ - Demand (0-25)             │
    │ - Competition (0-20)        │
    │ - Profit Margin (0-25)      │
    │ - Content Viability (0-15)  │
    │ - Risk (0-15)               │
    │ Total Score: 0-100          │
    └──────┬───────────────────────┘
           │
    ┌──────▼──────────────┐
    │ Top 20 Products     │
    │ Ready for Review    │
    └──────┬──────────────┘
           │
    ┌──────▼──────────────┐
    │ CEO AI              │
    │ (Filter & Rank)     │
    └──────┬──────────────┘
           │
    ┌──────▼──────────────────┐
    │ Notify Admin:           │
    │ "3 new opportunities"   │
    │ (Approval required)     │
    └──────────────────────────┘
```

**AI Models:**
- Trend Hunter AI: Gemini Flash (quick data parsing)
- Product AI: Qwen3 (quick scoring)
- CEO AI: Claude Sonnet (complex filtering)

**Output:**
- List of top 20 products with scores
- Recommendation: "HIGH opportunity" / "MEDIUM" / "PASS"
- Admin dashboard notification

**Storage:**
- Save to `products` table
- Log scores in `ai_agent_tasks` table

---

### 2.2. Content Creation Workflow

**Trigger:** When product approved by admin OR Manual trigger

**Flow:**

```
┌───────────────────────┐
│ Admin Approves        │
│ Product to Market     │
└──────────┬────────────┘
           │
┌──────────▼───────────────────┐
│ Content AI Batch Job         │
│ (Create 30-day content plan) │
└──────────┬───────────────────┘
           │
    ┌──────┴─────────────────┐
    │ Content Generation:    │
    │ 1. Descriptions (x3)   │
    │ 2. Captions (x10)      │
    │ 3. Video scripts (x5)  │
    │ 4. Email copy (x3)     │
    └──────┬─────────────────┘
           │
    ┌──────▼──────────────┐
    │ Creative AI         │
    │ (Generate Mockups)  │
    └──────┬──────────────┘
           │
    ├─────────────────────┤
    │ Ads AI              │
    │ (Suggest messaging) │
    └──────┬──────────────┘
           │
    ┌──────▼──────────────────────┐
    │ Content Review Queue        │
    │ (Manager approves)          │
    │ Status: PENDING_REVIEW      │
    └──────┬───────────────────────┘
           │
    ┌──────▼──────────────┐
    │ Content Calendar    │
    │ (Schedule posts)    │
    │ Next 30 days        │
    └──────┬──────────────┘
           │
    ┌──────▼──────────────┐
    │ Store in DB:        │
    │ - content_assets    │
    │ - content_calendar  │
    │ - file storage (S3) │
    └─────────────────────┘
```

**AI Models:**
- Content AI: Qwen3 (fast, cost-effective)
- Creative AI: DALL-E / Canva AI (images)
- Ads AI: Gemini Flash (quick suggestions)

**Output:**
- 30 content assets (descriptions, captions, scripts)
- 3 mockup designs
- Content calendar with scheduled dates
- Estimated engagement predictions

**Approval Flow:**
```
Draft → Manager Review → Approved → Scheduled → Published → Analytics
```

---

### 2.3. Customer Sales Conversation Workflow

**Trigger:** Real-time (customer message arrives)

**Flow:**

```
┌────────────────────────────┐
│ Customer Message Received  │
│ (Facebook/Zalo/Website)    │
└──────────┬─────────────────┘
           │
┌──────────▼──────────────────────┐
│ Message Router                   │
│ - Extract intent                 │
│ - Fetch product context          │
│ - Look up customer history       │
└──────────┬──────────────────────┘
           │
    ┌──────▼─────────────┐
    │ Sales Script AI    │
    │ (Generate response)│
    │ Model: Gemini      │
    │ Max latency: 2s    │
    └──────┬─────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ Response Generation:             │
    │ - Search FAQ (pgvector)          │
    │ - Get inventory status           │
    │ - Get pricing/promotions         │
    │ - Generate 2-3 response options  │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────┐
    │ Output Manager:         │
    │ - Pick best response    │
    │ - Send via channel      │
    │ - Log conversation      │
    └──────┬──────────────────┘
           │
    ├─────────────────────────────────┤
    │ If Order Intent Detected:       │
    │ → Create order draft            │
    │ → Request confirmation          │
    └──────┬────────────────────────────┘
           │
    ┌──────▼──────────────────┐
    │ Customer Success AI     │
    │ (Follow-up scheduled)   │
    └──────────────────────────┘
```

**AI Models:**
- Sales AI: Gemini Flash (fast, <2s)
- Escalate to Claude if negative sentiment detected

**Safety Guardrails:**
```
✗ Never promise delivery time without confirmation
✗ Never reduce price without manager approval
✗ Never promise stock not in inventory
✓ Always reference FAQ for policies
✓ Log all conversations for audit
✓ Escalate to human if confidence < 70%
```

**Output:**
- Response sent to customer
- Log entry in `messages` table
- Order draft if applicable
- Analytics: response quality, conversion

---

### 2.4. Order Processing Workflow

**Trigger:** Payment received / Order confirmed

**Flow:**

```
┌──────────────────┐
│ Order Received   │
│ Status: PENDING  │
└────────┬─────────┘
         │
┌────────▼──────────────────┐
│ Fulfillment AI            │
│ (Validate & Process)      │
└────────┬──────────────────┘
         │
    ┌────▼──────────────────┐
    │ Check:                 │
    │ - Stock available      │
    │ - Payment confirmed    │
    │ - Address valid        │
    └────┬───────────────────┘
         │ ✓
┌────────▼──────────────────┐
│ Reserve Stock             │
│ Deduct from Inventory     │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│ Create Packing List       │
│ Status: CONFIRMED         │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│ Generate Shipping Label   │
│ (Call GHN/J&T API)        │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│ Create Shipment           │
│ Status: PACKED            │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│ Send Tracking to Customer │
│ (SMS/Email)               │
│ Status: SHIPPED           │
└────────┬──────────────────┘
         │
┌────────▼──────────────────┐
│ Track Delivery            │
│ (Poll shipping API)       │
└────────┬──────────────────┘
         │ (once delivered)
┌────────▼──────────────────┐
│ Customer Success AI       │
│ - Send delivery confirm   │
│ - Request review          │
│ - Offer feedback form     │
│ Status: DELIVERED         │
└──────────────────────────┘
```

**Automatic Alerts:**
- Low stock warning → Notify admin
- Delivery delayed → Notify customer
- Return requested → Escalate to team
- Payment failed → Retry or notify

---

### 2.5. Customer Feedback & Review Workflow

**Trigger:** Order delivered OR Customer initiates

**Flow:**

```
┌──────────────────────┐
│ Order Delivered      │
│ + 2 days              │
└────────┬─────────────┘
         │
┌────────▼──────────────────────┐
│ Customer Success AI           │
│ (Request feedback)            │
└────────┬──────────────────────┘
         │
    ┌────▼───────────────────┐
    │ Generate message:      │
    │ - Personalized thanks  │
    │ - Request review       │
    │ - Offer feedback link  │
    └────┬───────────────────┘
         │
    ┌────▼──────────────────┐
    │ Send via channel      │
    │ Track open/click      │
    └────┬──────────────────┘
         │
    ┌────▼──────────────────┐
    │ If Review Received:   │
    │ - Extract sentiment   │
    │ - Store in DB        │
    │ - Update product     │
    │   rating             │
    └────┬──────────────────┘
         │
    ┌────▼──────────────────┐
    │ If Negative Feedback: │
    │ - Alert support team  │
    │ - Suggest compensation│
    │ - Track issue         │
    └────┬──────────────────┘
         │
    ┌────▼──────────────────┐
    │ BI AI                 │
    │ - Calculate NPS       │
    │ - Product rating      │
    │ - Customer segment    │
    └──────────────────────┘
```

**Feedback Quality:**
- Extract key feedback (AI summarization)
- Flag spam/inappropriate reviews
- Calculate product rating impact

---

## 3. Specific AI Agent Specifications

### 3.1. Trend Hunter AI

**Purpose:** Discover trending products and market opportunities

**Input Data:**
- Shopee API (bestsellers, trending)
- TikTok Shop API (trending, viral)
- Google Trends data
- Search keyword volumes

**Output:**
```json
{
  "trends": [
    {
      "product_name": "Pickleball Set Premium",
      "trend_score": 95,
      "search_volume": 45000,
      "competitor_count": 23,
      "estimated_market_size": "$2.5M",
      "reason": "Viral on TikTok, 5M views"
    }
  ]
}
```

**Model:** Gemini Flash  
**Cost:** ~0.01 per run  
**Frequency:** Daily at 0:00 AM

**Prompt Template:**
```
Analyze marketplace data and identify top 10 trending products in category: {{category}}.
For each product:
- Product name
- Current demand (0-100)
- Number of competitors
- Price range
- Estimated market size
- Why it's trending

Format as JSON, rank by opportunity.
```

---

### 3.2. Product AI

**Purpose:** Score products based on business opportunity

**Input:**
- Product name, category, price
- Market size, competition data
- Cost & margin data
- Content feasibility

**Scoring Formula:**
```
Score = (Demand × 0.25) + (Margin × 0.25) + 
        (Content × 0.15) + (Low Risk × 0.15) + 
        (Low Competition × 0.20)

Demand: How many people search for it
Margin: Profit margin % (50%+ = 25 points)
Content: How easy to create video/photos
Risk: Return rate, quality issues
Competition: Number of sellers
```

**Output:**
```json
{
  "product_id": "uuid",
  "total_score": 92.5,
  "breakdown": {
    "demand_score": 95,      // 0-25
    "competition_score": 78, // 0-20
    "profit_margin_score": 90, // 0-25
    "content_viability_score": 95, // 0-15
    "risk_score": 20          // 0-15 (lower is better)
  },
  "recommendation": "HIGH - Push this product",
  "predicted_monthly_sales": 250,
  "predicted_revenue": 37500000
}
```

**Model:** Qwen3  
**Cost:** ~0.005 per score  
**Frequency:** Daily at 1:00 AM (batch for all products)

---

### 3.3. Content AI

**Purpose:** Generate product descriptions, captions, and scripts

**Capabilities:**

1. **Product Description**
   - Platform-specific (Shopee, TikTok, Website)
   - Include: features, benefits, USP, CTA
   - 200-300 words
   - Multiple variations

2. **Social Media Captions**
   - Platform-optimized (Instagram, TikTok, Facebook)
   - Include: hook, value, hashtags
   - 100-150 characters
   - 3-5 variations

3. **Video Scripts**
   - Scene-by-scene breakdown
   - Duration indicators
   - Dialogue & B-roll notes
   - Music recommendations

**Model:** Qwen3  
**Cost:** ~0.01-0.03 per generation  
**Latency:** 5-10 seconds

**Prompt Example:**
```
Write 3 TikTok captions for "{{product_name}}" ({{category}}).
Target audience: {{audience}}
Tone: {{tone}} (playful/aspirational/educational)
Include: hook, value proposition, CTA
Keep under 150 chars with relevant hashtags.

Format as JSON array with keys: caption, hashtags.
```

---

### 3.4. Sales AI

**Purpose:** Answer customer questions and drive conversions

**Knowledge Sources:**
1. FAQ database (vector search)
2. Product inventory (real-time)
3. Customer purchase history
4. Pricing & promotions

**Response Generation:**
```
1. Understand intent (question type)
2. Fetch relevant context
3. Generate 2-3 response options
4. Pick best based on sentiment
5. Add personal touch
6. Check guardrails
```

**Safety Guardrails:**
```python
def validate_response(response):
    checks = [
        not "confirm delivery" in response,  # no promises
        not "reduce price" in response,      # no discounts
        not "guarantee" in response,         # unless verified
        confidence_score > 0.7                # only if confident
    ]
    return all(checks)
```

**Model:** Gemini Flash  
**Cost:** ~0.002 per response  
**Latency:** < 3 seconds (SLA)

---

### 3.5. Customer Success AI

**Purpose:** Retain customers and increase repeat purchases

**Activities:**
1. Post-purchase follow-up
2. Review requests
3. Upsell recommendations
4. Churn prevention

**Triggers:**
- Order delivered (+2 days) → Request review
- 30 days no purchase → Send offer
- Negative review → Escalate to team
- Cart abandoned → Reminder

**Model:** Gemini Flash / Qwen3

---

### 3.6. BI Analyze AI

**Purpose:** Extract insights from data and recommend optimizations

**Analysis Types:**
1. **Product Analysis**
   - Top/bottom performers
   - Margin trends
   - Recommendation: continue/stop/push

2. **Customer Analysis**
   - Segment trends
   - LTV by segment
   - Churn prediction

3. **Marketing Efficiency**
   - Cost per order by channel
   - Content ROI
   - Best-performing content type

4. **AI Cost Optimization**
   - Token usage trends
   - Cost per business outcome
   - Recommendations to reduce

**Frequency:** Daily at 5:00 AM  
**Output:** Dashboard + notifications

**Sample Query:**
```sql
SELECT 
  DATE(p.created_at) as sell_date,
  COUNT(DISTINCT o.id) as orders,
  SUM(o.total_amount - p.cost_price * oi.quantity) as profit
FROM products p
JOIN order_items oi ON p.id = oi.variant_id
JOIN orders o ON oi.order_id = o.id
GROUP BY sell_date
ORDER BY sell_date DESC
LIMIT 30;
```

---

## 4. AI Model Selection Strategy

### 4.1. Model Routing Decision Tree

```
Task submitted
    │
    ├─→ Is it deterministic? (workflow, calculation)
    │   └─→ Use n8n/API only (no LLM)
    │
    ├─→ Is it real-time? (< 3s required)
    │   ├─→ Large context needed?
    │   │   └─→ Claude Sonnet (if budget)
    │   │       └─→ Gemini Flash (default)
    │   └─→ Content generation?
    │       └─→ Qwen3
    │
    ├─→ Is it complex reasoning? (strategy, analysis)
    │   └─→ Claude Sonnet / GPT-5
    │       (called by CEO AI only)
    │
    └─→ Is it batch/async? (5-30s OK)
        └─→ Qwen3 (cheapest for writing)
            OR Gemini Flash (balanced)
```

### 4.2. Cost Optimization Rules

```
1. Default to Gemini Flash
   - $0.075/1M input tokens
   - Fast (1-2s)
   - Good quality for standard tasks

2. Use Qwen3 for content generation
   - Cheaper than Gemini
   - Good for long-form writing
   - Slightly slower (5-10s OK for batch)

3. Reserve Claude/GPT-5 for:
   - Complex strategy decisions
   - High-stakes customer issues
   - When Gemini returns poor results
   - Premium features (future)

4. Implement token budgets
   - Daily budget: Max 10M tokens/day
   - Alert at 80% usage
   - Auto-fallback to cheaper model

5. Cache prompts
   - System prompts
   - FAQ database
   - Product catalog context
   - Reduce context tokens by 30-40%
```

---

## 5. Workflow Automation with n8n

### 5.1. Sample n8n Workflow: Daily Report

```json
{
  "name": "Daily KPI Report",
  "trigger": "Schedule (0:00 AM)",
  "steps": [
    {
      "node": "Query PostgreSQL",
      "action": "Get daily KPIs",
      "query": "SELECT * FROM daily_kpi_snapshots WHERE snapshot_date = TODAY()"
    },
    {
      "node": "Call BI AI",
      "model": "Gemini Flash",
      "prompt": "Summarize daily performance: {{kpi_data}}. Give 3 key insights and recommendations."
    },
    {
      "node": "Format Email",
      "template": "Daily Report Template"
    },
    {
      "node": "Send Email",
      "recipients": ["admin@company.com"]
    },
    {
      "node": "Log Execution",
      "table": "workflow_executions"
    }
  ]
}
```

### 5.2. Key Workflows

| Workflow | Trigger | Frequency | Purpose |
|----------|---------|-----------|---------|
| Product Scoring | Schedule | Daily 1 AM | Re-score all products |
| Content Generation | Manual + Product Approved | On-demand | Create 30-day plan |
| Report Generation | Schedule | Daily 5 AM | Daily KPI report |
| Stock Reorder | Stock < threshold | Real-time | Alert low stock |
| Customer Segment | Schedule | Weekly | Update segments |
| Invoice Generation | Order Delivered | Real-time | Create receipt |
| Email Campaign | Schedule | Weekly | Send promotions |

---

## 6. Monitoring & Observability

### 6.1. AI Agent Metrics

```
Metric: AI Agent Task Success Rate
Query: 
  SELECT 
    agent_name,
    COUNT(*) as total_tasks,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
    (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
  FROM ai_agent_tasks
  WHERE created_at > NOW() - INTERVAL '24h'
  GROUP BY agent_name
  ORDER BY success_rate DESC;

Alert: If success_rate < 95%, notify team
```

### 6.2. Cost Tracking

```
Metric: Daily AI Cost
SELECT 
  DATE(created_at) as cost_date,
  SUM(estimated_cost) as daily_cost,
  COUNT(*) as task_count,
  AVG(estimated_cost) as avg_cost_per_task
FROM ai_agent_tasks
WHERE created_at > NOW() - INTERVAL '30d'
GROUP BY cost_date
ORDER BY cost_date DESC;

Alert: If daily_cost > $5, throttle non-critical tasks
```

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Ready for Implementation |
| Last Updated | 27/06/2026 |
| Audience | Development Team |
| Next Review | After first 2 weeks of live data |

---

**Next Steps:**
1. Implement AI Gateway (LiteLLM)
2. Create prompt templates in database
3. Set up monitoring dashboards
4. Conduct performance testing
5. Begin MVP rollout
