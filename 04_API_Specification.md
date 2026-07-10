# AI Commerce Platform - API Specification

**Version:** 1.0  
**Base URL:** `https://api.commerce.local/api/v1`  
**Authentication:** JWT Bearer Token  
**Content-Type:** `application/json`

---

## 1. Authentication Endpoints

### 1.1. User Registration

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "email": "user@example.com",
    "username": "john_doe",
    "created_at": "2026-06-27T10:30:00Z"
  }
}
```

### 1.2. User Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "expires_in": 900,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "operator"
    }
  }
}
```

### 1.3. Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGc..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "expires_in": 900
  }
}
```

### 1.4. Logout

```http
POST /auth/logout
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 2. Product Management Endpoints

### 2.1. Create Product

```http
POST /products
Authorization: Bearer <token>
Content-Type: application/json

{
  "sku": "TSHIRT-001",
  "name": "Pickleball T-Shirt Premium",
  "description": "High-quality athletic t-shirt for pickleball players",
  "short_description": "Premium pickleball t-shirt",
  "category_id": "uuid",
  "cost_price": 50000,
  "retail_price": 150000,
  "tags": ["trending", "bestseller"],
  "primary_image_url": "https://..."
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sku": "TSHIRT-001",
    "name": "Pickleball T-Shirt Premium",
    "product_score": 0,
    "status": "active",
    "created_at": "2026-06-27T10:30:00Z"
  }
}
```

### 2.2. Get Product Details

```http
GET /products/{product_id}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sku": "TSHIRT-001",
    "name": "Pickleball T-Shirt Premium",
    "description": "...",
    "category_id": "uuid",
    "cost_price": 50000,
    "retail_price": 150000,
    "product_score": 78.5,
    "demand_score": 85,
    "competition_score": 72,
    "profit_margin_score": 90,
    "content_viability_score": 95,
    "risk_score": 20,
    "status": "active",
    "variants": [
      {
        "id": "uuid",
        "variant_sku": "TSHIRT-001-M-RED",
        "size": "M",
        "color": "Red",
        "stock_quantity": 50,
        "retail_price": 150000
      }
    ],
    "created_at": "2026-06-27T10:30:00Z",
    "updated_at": "2026-06-27T11:00:00Z"
  }
}
```

### 2.3. List Products

```http
GET /products?page=1&limit=20&category_id=uuid&status=active&sort=-product_score
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sku": "TSHIRT-001",
      "name": "Pickleball T-Shirt Premium",
      "retail_price": 150000,
      "product_score": 78.5,
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

### 2.4. Update Product

```http
PUT /products/{product_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Pickleball T-Shirt Premium - Updated",
  "retail_price": 160000,
  "tags": ["trending", "bestseller", "seasonal"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Pickleball T-Shirt Premium - Updated",
    "updated_at": "2026-06-27T11:30:00Z"
  }
}
```

### 2.5. Create Product Variant

```http
POST /products/{product_id}/variants
Authorization: Bearer <token>
Content-Type: application/json

{
  "size": "M",
  "color": "Red",
  "cost_price": 50000,
  "retail_price": 150000,
  "stock_quantity": 100
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "variant_sku": "TSHIRT-001-M-RED",
    "size": "M",
    "color": "Red",
    "stock_quantity": 100,
    "created_at": "2026-06-27T10:30:00Z"
  }
}
```

### 2.6. Update Inventory

```http
PATCH /products/{product_id}/variants/{variant_id}/stock
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity_change": -5,
  "reason": "sold",
  "reference_id": "order-uuid"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "variant_id": "uuid",
    "stock_quantity": 95,
    "transaction_id": "uuid"
  }
}
```

---

## 3. AI Content Generation Endpoints

### 3.1. Generate Product Description

```http
POST /ai/content/generate-description
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "uuid",
  "target_platform": "shopee", // shopee, tiktok, website
  "variations": 3
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "variations": [
      {
        "version": 1,
        "description": "Mô tả sản phẩm phiên bản 1...",
        "word_count": 245
      },
      {
        "version": 2,
        "description": "Mô tả sản phẩm phiên bản 2...",
        "word_count": 258
      }
    ],
    "tokens_used": 1200,
    "estimated_cost": 0.02
  }
}
```

### 3.2. Generate Social Media Caption

```http
POST /ai/content/generate-caption
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "uuid",
  "platform": "tiktok", // facebook, tiktok, instagram
  "vibe": "playful", // playful, aspirational, educational
  "variations": 3
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "variations": [
      {
        "version": 1,
        "caption": "Chị yêu thích #pickleball không? 🎾 Áo này siêu mát mẻ cho mùa hè ấy... 😍",
        "char_count": 120,
        "hashtags": ["#pickleball", "#thethao", "#tiktok"]
      }
    ],
    "tokens_used": 600,
    "estimated_cost": 0.01
  }
}
```

### 3.3. Generate Video Script

```http
POST /ai/content/generate-video-script
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "uuid",
  "video_type": "unboxing", // unboxing, try-on, tutorial, testimonial
  "duration_seconds": 30
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "script": {
      "title": "Pickleball T-Shirt Unboxing",
      "scenes": [
        {
          "scene": 1,
          "duration_seconds": 3,
          "action": "Đưa hộp lên camera",
          "talking_points": "Chào các bạn yêu thích pickleball!"
        },
        {
          "scene": 2,
          "duration_seconds": 5,
          "action": "Mở hộp pháp",
          "talking_points": "Xem chất lượng áo này như thế nào..."
        }
      ],
      "props_needed": ["hộp", "áo", "bàn"],
      "music_mood": "upbeat, energetic",
      "filming_tips": "Quay ở nơi sáng, background sạch sẽ"
    },
    "tokens_used": 1800,
    "estimated_cost": 0.03
  }
}
```

### 3.4. Get Content Generation History

```http
GET /ai/content/history?product_id=uuid&limit=20&offset=0
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "content_type": "product_description",
      "product_id": "uuid",
      "ai_model_used": "qwen-3",
      "tokens_used": 1200,
      "estimated_cost": 0.02,
      "created_at": "2026-06-27T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

---

## 4. Sales & Customer Endpoints

### 4.1. Get Sales Scripts for Product

```http
GET /ai/sales/scripts/{product_id}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "product_id": "uuid",
    "scripts": [
      {
        "concern": "size_question",
        "responses": [
          {
            "version": 1,
            "response": "Em có tất cả size từ XS đến XL ạ. Chị muốn size nào?"
          },
          {
            "version": 2,
            "response": "Chị ơi, em vừa check size [size] còn 10 cái. Chị có muốn mua không?"
          }
        ]
      },
      {
        "concern": "quality_question",
        "responses": [...]
      }
    ]
  }
}
```

### 4.2. Add Customer

```http
POST /customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "0987654321",
  "email": "customer@example.com",
  "first_name": "Ngân",
  "last_name": "Lê",
  "city": "Ho Chi Minh",
  "district": "District 1",
  "preferred_size": "M"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "0987654321",
    "email": "customer@example.com",
    "first_name": "Ngân",
    "last_name": "Lê",
    "lifetime_value": 0,
    "segment": "New",
    "created_at": "2026-06-27T10:30:00Z"
  }
}
```

### 4.3. Get Customer Profile

```http
GET /customers/{customer_id}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "0987654321",
    "email": "customer@example.com",
    "first_name": "Ngân",
    "last_name": "Lê",
    "lifetime_value": 500000,
    "total_orders": 3,
    "repeat_purchase_count": 2,
    "segment": "Regular",
    "last_purchase_at": "2026-06-25T14:30:00Z",
    "purchase_history": [
      {
        "order_id": "uuid",
        "order_number": "ORD-20260625-001",
        "total_amount": 300000,
        "created_at": "2026-06-25T14:30:00Z"
      }
    ]
  }
}
```

---

## 5. Order Management Endpoints

### 5.1. Create Order

```http
POST /orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "customer_id": "uuid",
  "items": [
    {
      "variant_id": "uuid",
      "quantity": 2
    }
  ],
  "shipping_address": "123 Nguyen Hue, District 1, HCMC",
  "shipping_method": "GHN",
  "payment_method": "bank_transfer",
  "customer_notes": "Giao vào lúc 14h"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_number": "ORD-20260627-001",
    "customer_id": "uuid",
    "subtotal": 300000,
    "discount_amount": 0,
    "shipping_cost": 30000,
    "total_amount": 330000,
    "status": "pending",
    "payment_status": "unpaid",
    "created_at": "2026-06-27T10:30:00Z"
  }
}
```

### 5.2. Get Order Details

```http
GET /orders/{order_id}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_number": "ORD-20260627-001",
    "customer": {
      "id": "uuid",
      "name": "Ngân Lê",
      "phone": "0987654321"
    },
    "items": [
      {
        "product_name": "Pickleball T-Shirt",
        "variant_name": "M - Red",
        "quantity": 2,
        "unit_price": 150000,
        "subtotal": 300000
      }
    ],
    "subtotal": 300000,
    "shipping_cost": 30000,
    "total_amount": 330000,
    "status": "shipped",
    "tracking_number": "GHN123456789",
    "timeline": [
      {
        "status": "pending",
        "timestamp": "2026-06-27T10:30:00Z"
      },
      {
        "status": "confirmed",
        "timestamp": "2026-06-27T11:00:00Z"
      },
      {
        "status": "shipped",
        "timestamp": "2026-06-27T14:00:00Z"
      }
    ]
  }
}
```

### 5.3. Confirm Order

```http
PATCH /orders/{order_id}/confirm
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "order_id": "uuid",
    "status": "confirmed",
    "confirmed_at": "2026-06-27T11:00:00Z"
  }
}
```

### 5.4. Create Shipment

```http
POST /orders/{order_id}/shipments
Authorization: Bearer <token>
Content-Type: application/json

{
  "shipping_method": "GHN",
  "receiver_address": "123 Nguyen Hue, District 1, HCMC"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "shipment_id": "uuid",
    "tracking_number": "GHN123456789",
    "status": "picked_up",
    "estimated_delivery_date": "2026-06-29"
  }
}
```

### 5.5. List Orders

```http
GET /orders?status=completed&page=1&limit=20&sort=-created_at
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "order_number": "ORD-20260627-001",
      "customer_name": "Ngân Lê",
      "total_amount": 330000,
      "status": "completed",
      "created_at": "2026-06-27T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "total_pages": 8
  }
}
```

---

## 6. Dashboard & Analytics Endpoints

### 6.1. Executive Dashboard Summary

```http
GET /dashboards/executive/summary
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": "today",
    "revenue": {
      "value": 1500000,
      "change_percent": 12.5,
      "previous_period": 1333333
    },
    "profit": {
      "value": 450000,
      "margin_percent": 30
    },
    "orders": {
      "new": 5,
      "completed": 3,
      "pending": 2
    },
    "customers": {
      "new": 1,
      "repeat_rate": 45
    },
    "top_products": [
      {
        "id": "uuid",
        "name": "Pickleball T-Shirt",
        "units_sold": 15,
        "revenue": 2250000
      }
    ]
  }
}
```

### 6.2. Product Intelligence Dashboard

```http
GET /dashboards/products/intelligence
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_products": 45,
    "top_opportunities": [
      {
        "id": "uuid",
        "name": "Pickleball T-Shirt Premium",
        "score": 92.5,
        "demand_score": 95,
        "competition_score": 78,
        "potential_revenue": 10000000
      }
    ],
    "worst_performers": [
      {
        "id": "uuid",
        "name": "Old Model Shorts",
        "score": 35.0,
        "units_sold": 2,
        "recommendation": "discontinue"
      }
    ]
  }
}
```

### 6.3. AI Cost Dashboard

```http
GET /dashboards/ai-cost/summary?period=week
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": "week",
    "total_cost": 5.42,
    "daily_breakdown": [
      {
        "date": "2026-06-27",
        "cost": 0.85,
        "token_usage": 42500
      }
    ],
    "by_agent": [
      {
        "agent": "content_ai",
        "cost": 2.10,
        "token_usage": 105000,
        "task_count": 45
      },
      {
        "agent": "sales_ai",
        "cost": 1.20,
        "token_usage": 60000,
        "task_count": 120
      }
    ],
    "by_model": [
      {
        "model": "gemini-flash",
        "cost": 2.50,
        "percentage": 46
      },
      {
        "model": "qwen-3",
        "cost": 2.10,
        "percentage": 39
      }
    ],
    "alerts": []
  }
}
```

---

## 7. Content Calendar Endpoints

### 7.1. Create Content & Schedule

```http
POST /content-calendar/schedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "content_asset_id": "uuid",
  "scheduled_date": "2026-06-28",
  "scheduled_time": "14:00",
  "channels": ["facebook", "instagram"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "content_asset_id": "uuid",
    "scheduled_date": "2026-06-28",
    "scheduled_time": "14:00",
    "status": "scheduled",
    "created_at": "2026-06-27T10:30:00Z"
  }
}
```

### 7.2. Approve Content

```http
PATCH /content/{content_id}/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "approved": true,
  "notes": "Great content! Post it."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "approved",
    "reviewed_by": "uuid",
    "reviewed_at": "2026-06-27T11:00:00Z"
  }
}
```

---

## 8. Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product with ID abc-123 not found",
    "status": 404,
    "timestamp": "2026-06-27T10:30:00Z",
    "trace_id": "req-xyz-789"
  }
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| INVALID_REQUEST | 400 | Input validation failed |
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| INTERNAL_ERROR | 500 | Server error |
| AI_API_ERROR | 503 | AI service unavailable |

---

## 9. Rate Limiting

- **Limit:** 100 requests per minute per user
- **Header:** `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Exceeded:** Returns 429 Too Many Requests

---

## 10. Pagination

All list endpoints support pagination:

```
GET /products?page=1&limit=20&offset=0&sort=-created_at
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `offset`: Offset from start (alternative to page)
- `sort`: Sort field (prefix `-` for descending)

**Response Pagination:**
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "total_pages": 8,
    "has_more": true
  }
}
```

---

## 11. Webhook Events (Future)

Events will be sent to configured webhook URL:

```json
{
  "event": "order.created",
  "timestamp": "2026-06-27T10:30:00Z",
  "data": {
    "order_id": "uuid",
    "order_number": "ORD-20260627-001",
    "total_amount": 330000
  }
}
```

**Events:**
- `order.created`
- `order.confirmed`
- `order.shipped`
- `product.created`
- `product.score_updated`
- `content.published`
- `ai_cost.high_usage_alert`

---

## 12. Implementation Notes

- All timestamps are in UTC (ISO 8601)
- Amounts in VND (currency)
- Token expiry: 15 minutes (access), 7 days (refresh)
- All endpoints require tenant context (inferred from user)
- Implement request/response logging (without sensitive data)
- Use correlation IDs for request tracing

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Ready for Implementation |
| Last Updated | 27/06/2026 |
| API Style | RESTful |
| Base URL | https://api.commerce.local/api/v1 |
