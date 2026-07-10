# AI Commerce Platform - Database Schema

**Database:** PostgreSQL 15+  
**Version:** 1.0  
**Date:** 27/06/2026

---

## 1. Core Tables

### 1.1. Users & Authentication

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  role VARCHAR(50) NOT NULL DEFAULT 'operator', -- admin, manager, operator, viewer
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- Create index on email for quick lookup
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Tenants (shops) - for future multi-tenant
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  owner_id UUID NOT NULL REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-Tenant relationship (RBAC)
CREATE TABLE user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'operator', -- admin, manager, operator, viewer
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant ON user_tenants(tenant_id);
```

### 1.2. Products & Variants

```sql
-- Product categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  parent_id UUID REFERENCES categories(id), -- for subcategories
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_categories_tenant ON categories(tenant_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  category_id UUID NOT NULL REFERENCES categories(id),
  supplier_id UUID, -- future reference to suppliers table
  cost_price DECIMAL(10, 2) NOT NULL,
  retail_price DECIMAL(10, 2) NOT NULL,
  
  -- AI Scoring
  product_score DECIMAL(5, 2) DEFAULT 0, -- 0-100
  demand_score DECIMAL(5, 2) DEFAULT 0,
  competition_score DECIMAL(5, 2) DEFAULT 0,
  profit_margin_score DECIMAL(5, 2) DEFAULT 0,
  content_viability_score DECIMAL(5, 2) DEFAULT 0,
  risk_score DECIMAL(5, 2) DEFAULT 0,
  
  -- Status & Tracking
  status VARCHAR(50) DEFAULT 'active', -- active, archived, discontinued
  visibility VARCHAR(50) DEFAULT 'public', -- public, draft, private
  tags JSONB DEFAULT '[]', -- trending, bestseller, seasonal
  
  -- Images & Media
  primary_image_url TEXT,
  image_urls TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score_updated_at TIMESTAMP
);

CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_score ON products(product_score DESC);
CREATE INDEX idx_products_status ON products(status);

-- Product Variants (Size × Color × etc)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_sku VARCHAR(100) NOT NULL,
  size VARCHAR(50), -- XS, S, M, L, XL, etc
  color VARCHAR(50), -- Red, Blue, Green, etc
  
  -- Pricing (can override product price)
  cost_price DECIMAL(10, 2),
  retail_price DECIMAL(10, 2),
  
  -- Inventory
  stock_quantity INT DEFAULT 0,
  reorder_point INT DEFAULT 10,
  
  -- Variant-specific info
  images TEXT[],
  barcode VARCHAR(100),
  weight_kg DECIMAL(5, 2), -- for shipping calc
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(product_id, variant_sku)
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(variant_sku);
CREATE INDEX idx_product_variants_stock ON product_variants(stock_quantity);

-- Stock transaction log (audit trail)
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity_change INT NOT NULL, -- positive or negative
  reason VARCHAR(100) NOT NULL, -- new_stock, sold, return, adjustment, damage
  reference_id UUID, -- order_id, return_id, etc
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_transactions_variant ON stock_transactions(variant_id);
CREATE INDEX idx_stock_transactions_created ON stock_transactions(created_at DESC);
```

### 1.3. Customers

```sql
-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Address
  street_address VARCHAR(255),
  ward VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Vietnam',
  
  -- Preferences
  preferred_size VARCHAR(50),
  preferred_colors TEXT[],
  notes TEXT,
  
  -- Customer Intelligence
  lifetime_value DECIMAL(12, 2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  repeat_purchase_count INT DEFAULT 0,
  segment VARCHAR(50), -- VIP, Regular, At-risk, Churned, New
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_purchase_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_segment ON customers(segment);
CREATE INDEX idx_customers_ltv ON customers(lifetime_value DESC);

-- Customer communication history
CREATE TABLE customer_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL, -- facebook, zalo, email, website, sms
  subject VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_conversations_customer ON customer_conversations(customer_id);
CREATE INDEX idx_customer_conversations_channel ON customer_conversations(channel);

-- Messages (chat/conversation history)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES customer_conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL, -- customer, ai, human
  sender_id UUID, -- customer_id or user_id
  message_text TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- text, image, product_link
  
  -- AI tracking
  ai_model_used VARCHAR(100), -- gemini-flash, qwen, etc
  ai_confidence_score DECIMAL(3, 2),
  ai_response BOOLEAN DEFAULT false,
  human_approved BOOLEAN,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

### 1.4. Orders & Payments

```sql
-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE NOT NULL, -- ORD-YYYYMMDD-XXXXX
  
  customer_id UUID NOT NULL REFERENCES customers(id),
  
  -- Amounts
  subtotal DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  
  -- Shipping
  shipping_address TEXT NOT NULL, -- JSON or formatted text
  shipping_method VARCHAR(50), -- GHN, Giao Hàng Nhanh, etc
  tracking_number VARCHAR(100),
  estimated_delivery_date DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, packed, shipped, delivered, completed, returned, cancelled
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid, partially_paid, refunded
  
  -- Notes
  customer_notes TEXT,
  internal_notes TEXT,
  
  -- Creation & Updates
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  
  product_name VARCHAR(255), -- snapshot at purchase time
  variant_name VARCHAR(255), -- size + color snapshot
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL, -- unit_price × quantity
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  amount DECIMAL(12, 2) NOT NULL,
  method VARCHAR(50) NOT NULL, -- bank_transfer, cash_on_delivery, card, etc
  
  -- Payment gateway
  gateway VARCHAR(100), -- stripe, zalopay, momo, etc
  transaction_id VARCHAR(100) UNIQUE,
  
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Returns/Refunds
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  reason VARCHAR(255) NOT NULL, -- quality, wrong_size, not_as_described, damaged, etc
  description TEXT,
  
  status VARCHAR(50) DEFAULT 'requested', -- requested, approved, rejected, received, refunded
  
  tracking_number VARCHAR(100), -- return shipping
  refund_amount DECIMAL(12, 2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  refunded_at TIMESTAMP
);

CREATE INDEX idx_returns_order ON returns(order_id);
CREATE INDEX idx_returns_status ON returns(status);
```

---

## 2. Content & Marketing Tables

### 2.1. Content Management

```sql
-- Content Assets (posts, scripts, etc)
CREATE TABLE content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  content_type VARCHAR(50) NOT NULL, -- product_description, caption, video_script, email, social_post
  platform VARCHAR(50), -- facebook, tiktok, instagram, email, website
  
  title VARCHAR(255),
  content TEXT NOT NULL,
  
  -- AI metadata
  ai_generated BOOLEAN DEFAULT true,
  ai_model_used VARCHAR(100),
  
  -- Variants (A/B testing)
  variant_name VARCHAR(100), -- A, B, C, etc
  
  -- Status & Approval
  status VARCHAR(50) DEFAULT 'draft', -- draft, pending_review, approved, published, archived
  approval_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP
);

CREATE INDEX idx_content_assets_tenant ON content_assets(tenant_id);
CREATE INDEX idx_content_assets_product ON content_assets(product_id);
CREATE INDEX idx_content_assets_type ON content_assets(content_type);
CREATE INDEX idx_content_assets_status ON content_assets(status);

-- Content Calendar (scheduling)
CREATE TABLE content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  content_asset_id UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  
  published_date TIMESTAMP,
  published_url TEXT,
  
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, published, failed, cancelled
  
  reach INT DEFAULT 0,
  engagement INT DEFAULT 0,
  clicks INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_content_calendar_tenant ON content_calendar(tenant_id);
CREATE INDEX idx_content_calendar_date ON content_calendar(scheduled_date);
CREATE INDEX idx_content_calendar_status ON content_calendar(status);

-- FAQ Knowledge Base
CREATE TABLE faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  category VARCHAR(100) NOT NULL, -- size_guide, shipping, return, payment, quality
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  
  -- Vector embedding (for semantic search)
  question_embedding VECTOR(1536), -- using pgvector extension
  
  priority INT DEFAULT 0, -- higher = more frequently asked
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_faq_items_tenant ON faq_items(tenant_id);
CREATE INDEX idx_faq_items_category ON faq_items(category);
CREATE INDEX idx_faq_items_embedding ON faq_items USING ivfflat(question_embedding vector_cosine_ops);
```

---

## 3. AI & Automation Tables

### 3.1. AI Agent Operations

```sql
-- AI Agent task logs
CREATE TABLE ai_agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  agent_name VARCHAR(100) NOT NULL, -- content_ai, sales_ai, product_ai, etc
  task_type VARCHAR(100) NOT NULL, -- generate_caption, score_product, etc
  
  input_data JSONB,
  output_data JSONB,
  
  model_used VARCHAR(100),
  tokens_used INT,
  estimated_cost DECIMAL(10, 4),
  
  status VARCHAR(50) DEFAULT 'completed', -- pending, processing, completed, failed
  error_message TEXT,
  
  execution_time_ms INT,
  
  triggered_by VARCHAR(50), -- manual, schedule, webhook, system
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_ai_agent_tasks_tenant ON ai_agent_tasks(tenant_id);
CREATE INDEX idx_ai_agent_tasks_agent ON ai_agent_tasks(agent_name);
CREATE INDEX idx_ai_agent_tasks_status ON ai_agent_tasks(status);
CREATE INDEX idx_ai_agent_tasks_created ON ai_agent_tasks(created_at DESC);

-- Prompt templates (versioned)
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  prompt_type VARCHAR(100) NOT NULL, -- content_caption, product_score, sales_response
  version INT DEFAULT 1,
  
  template_text TEXT NOT NULL, -- with {{variables}}
  
  model VARCHAR(100) NOT NULL, -- gemini-flash, qwen, etc
  temperature DECIMAL(3, 2) DEFAULT 0.7,
  max_tokens INT DEFAULT 1000,
  
  status VARCHAR(50) DEFAULT 'active', -- active, archived, testing
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id, name, version)
);

CREATE INDEX idx_prompt_templates_tenant ON prompt_templates(tenant_id);
CREATE INDEX idx_prompt_templates_status ON prompt_templates(status);

-- Workflow executions
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  workflow_name VARCHAR(100) NOT NULL,
  
  input_data JSONB,
  output_data JSONB,
  
  status VARCHAR(50) DEFAULT 'running', -- running, completed, failed
  error_message TEXT,
  
  execution_time_ms INT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_workflow_executions_tenant ON workflow_executions(tenant_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
```

---

## 4. Analytics & Finance Tables

### 4.1. Analytics

```sql
-- Daily KPI snapshots (for fast dashboard loading)
CREATE TABLE daily_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  snapshot_date DATE NOT NULL,
  
  -- Revenue
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  total_cost DECIMAL(12, 2) DEFAULT 0,
  total_profit DECIMAL(12, 2) DEFAULT 0,
  profit_margin_percent DECIMAL(5, 2) DEFAULT 0,
  
  -- Orders
  new_orders INT DEFAULT 0,
  completed_orders INT DEFAULT 0,
  cancelled_orders INT DEFAULT 0,
  returned_orders INT DEFAULT 0,
  
  -- Customers
  new_customers INT DEFAULT 0,
  repeat_customers INT DEFAULT 0,
  
  -- Inventory
  total_stock_value DECIMAL(12, 2) DEFAULT 0,
  low_stock_items INT DEFAULT 0,
  
  -- AI Cost
  ai_token_usage INT DEFAULT 0,
  ai_cost DECIMAL(10, 4) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_daily_kpi_tenant ON daily_kpi_snapshots(tenant_id);
CREATE INDEX idx_daily_kpi_date ON daily_kpi_snapshots(snapshot_date DESC);

-- Product performance tracking
CREATE TABLE product_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  metric_date DATE NOT NULL,
  
  units_sold INT DEFAULT 0,
  revenue DECIMAL(12, 2) DEFAULT 0,
  views INT DEFAULT 0,
  click_through_rate DECIMAL(5, 2), -- percent
  conversion_rate DECIMAL(5, 2), -- percent
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(product_id, metric_date)
);

CREATE INDEX idx_product_performance_product ON product_performance(product_id);
CREATE INDEX idx_product_performance_date ON product_performance(metric_date DESC);
```

### 4.2. Finance

```sql
-- Financial transactions
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  transaction_type VARCHAR(50) NOT NULL, -- revenue, cost, expense, refund
  category VARCHAR(100), -- sales, ai_cost, shipping, ads, etc
  
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'VND',
  
  reference_id UUID, -- order_id, invoice_id, etc
  description TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_financial_transactions_tenant ON financial_transactions(tenant_id);
CREATE INDEX idx_financial_transactions_type ON financial_transactions(transaction_type);
CREATE INDEX idx_financial_transactions_created ON financial_transactions(created_at DESC);
```

---

## 5. System & Configuration Tables

### 5.1. System Logs & Audits

```sql
-- Audit log (all changes)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- create, update, delete, approve, etc
  
  entity_type VARCHAR(100) NOT NULL, -- product, order, content, etc
  entity_id UUID NOT NULL,
  
  old_values JSONB,
  new_values JSONB,
  
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- API Keys (for future integrations)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
```

---

## 6. Vector Storage (pgvector)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base with embeddings
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  content_type VARCHAR(50) NOT NULL, -- product_info, policy, faq, script
  reference_id UUID, -- product_id or other reference
  
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- text-embedding-3-small dimension
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_base_tenant ON knowledge_base(tenant_id);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base USING ivfflat(embedding vector_cosine_ops);
```

---

## 7. Indexes & Performance Optimization

```sql
-- Frequently joined tables
CREATE INDEX idx_products_category_tenant ON products(tenant_id, category_id);
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX idx_order_items_product_order ON order_items(order_id, variant_id);

-- Full-text search (future)
ALTER TABLE products ADD COLUMN search_text tsvector;
CREATE INDEX idx_products_search ON products USING gin(search_text);

-- Composite indexes for common queries
CREATE INDEX idx_product_score_active ON products(product_score DESC) WHERE status = 'active';
CREATE INDEX idx_orders_recent ON orders(created_at DESC) WHERE status != 'cancelled';
```

---

## 8. Migration Strategy

### 8.1. Initial Setup

```bash
# 1. Create database
createdb ai_commerce_platform

# 2. Run migrations (using migration tool like Flyway or TypeORM)
npm run migration:run

# 3. Seed initial data (categories, users, etc)
npm run seed:run
```

### 8.2. Backup & Recovery

```bash
# Daily backup
pg_dump ai_commerce_platform > backup_$(date +%Y%m%d).sql

# Recovery
psql ai_commerce_platform < backup_20260627.sql
```

---

## 9. Data Retention Policy

| Table | Retention |
|-------|-----------|
| Completed Orders | Indefinite (business record) |
| Messages | 1 year (compliance) |
| AI Agent Tasks | 3 months (optimization) |
| Audit Logs | 2 years (compliance) |
| Stock Transactions | Indefinite (inventory audit) |
| Daily KPI Snapshots | Indefinite (business intel) |

---

## 10. Query Examples for Key Reports

```sql
-- Top products by score
SELECT id, name, product_score, retail_price, stock_quantity
FROM products
WHERE status = 'active'
ORDER BY product_score DESC
LIMIT 10;

-- Revenue by day
SELECT 
  DATE(created_at) as sale_date,
  COUNT(id) as orders,
  SUM(total_amount) as revenue,
  AVG(total_amount) as avg_order_value
FROM orders
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- Customer LTV
SELECT 
  c.id,
  c.first_name,
  c.phone,
  COUNT(o.id) as purchase_count,
  SUM(o.total_amount) as ltv
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id
ORDER BY ltv DESC;

-- AI Cost tracking
SELECT 
  DATE(created_at) as cost_date,
  agent_name,
  model_used,
  SUM(tokens_used) as total_tokens,
  SUM(estimated_cost) as total_cost
FROM ai_agent_tasks
GROUP BY cost_date, agent_name, model_used
ORDER BY cost_date DESC;
```

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Ready for Implementation |
| Last Updated | 27/06/2026 |
| Database | PostgreSQL 15+ |
| Extensions | pgvector |

---

**Note:** All tables include `created_at` and `updated_at` timestamps. Use triggers to auto-update `updated_at` on every modification.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repeat for other tables...
```
