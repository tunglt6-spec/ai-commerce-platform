# Platform Policy Process — Versioning & Review

> ⚠️ **NOT LEGAL ADVICE / NOT PLATFORM-VERIFIED**: Platform policy packs mã hóa hiểu biết của doanh nghiệp về chính sách các sàn/nền tảng (TikTok, Meta, Shopee, Google…). Hệ thống KHÔNG tự xác thực chính sách sàn; nội dung pack cần **con người rà soát** với chính sách chính thức của sàn.

---

## 1. Platform policy pack là gì

`platform_policy_packs` là gói quy tắc cho một nền tảng cụ thể ở một version cụ thể. Mỗi pack gồm:

| Trường | Ý nghĩa |
|---|---|
| `id` | Khóa chính. |
| `platform` | Nền tảng (tiktok/meta/shopee/…). |
| `version` | Số version tăng dần. |
| `status` | `DRAFT` / `IN_REVIEW` / `PUBLISHED` / `SUPERSEDED`. |
| `rules` | Rule DSL đặc thù nền tảng (safe JSON). |
| `reviewDueAt` | Hạn rà soát tiếp theo. |
| `reviewedBy` / `reviewedAt` | Người rà + thời điểm (bắt buộc để PUBLISHED). |
| `verifiedStatus` | Chỉ được set khi có `reviewedBy` là người thật. |

---

## 2. Versioning & review

- Pack **bất biến sau khi PUBLISHED** — thay đổi = tạo version mới (giống policy versioning ở `policy-model.md`).
- Chuyển sang `PUBLISHED` **bắt buộc** có `reviewedBy` (người thật) + `reviewedAt`.
- Version cũ chuyển `SUPERSEDED` khi version mới PUBLISHED.
- Mọi chuyển trạng thái ghi audit bất biến.

---

## 3. Cơ chế quá hạn rà soát (reviewDueAt overdue)

> **Bất biến vận hành**: Khi `reviewDueAt` **quá hạn**, hệ thống tự **siết chặt**, không tiếp tục hành xử như bình thường.

Khi một pack overdue, đối với các hành động phụ thuộc pack đó, hệ thống tự động:

1. **Tắt auto-publish** — không cho agent tự đăng công khai qua pack đã cũ.
2. **Tắt auto-ad-launch** — không cho tự khởi chạy quảng cáo.
3. **Hạ trần rủi ro về `DRAFT_ONLY` / `REQUIRE_APPROVAL`** — mọi hành động liên quan rớt xuống chỉ tạo nháp, hoặc bắt buộc phê duyệt con người.

Đây là biểu hiện của **fail-closed (P3)** và **policy freshness** (yếu tố #9 trong `risk-model.md`): pack cũ = rủi ro cao hơn cho tới khi được rà lại.

```
reviewDueAt còn hạn   → hành động theo enforcementMode bình thường
reviewDueAt QUÁ HẠN   → auto-publish OFF
                        auto-ad-launch OFF
                        risk floor ↑ (DRAFT_ONLY / REQUIRE_APPROVAL)
```

---

## 4. Không được giả mạo trạng thái "verified"

> **Bất biến**: Không bao giờ set `verifiedStatus` / `PUBLISHED` mà **không có người rà thật**.

- `verifiedStatus = true` chỉ hợp lệ khi có `reviewedBy` trỏ tới một người dùng có vai trò rà soát.
- Agent runtime **không** có quyền set trạng thái verified (P6).
- Tự động hóa (scheduler) có thể **nhắc** rà, **hạ cấp** khi overdue, nhưng **không** được tự nâng cấp lên verified.

---

## 5. Ranh giới trách nhiệm

| Lớp | Trong platform policy process |
|---|---|
| **Technical enforcement** | Chặn PUBLISHED thiếu reviewer; siết chế độ khi overdue; agent không set verified. |
| **Business policy** | Chọn nền tảng nào bật auto-publish/auto-ad. |
| **Legal review** | Một số quy tắc sàn chồng lấn luật (quảng cáo, khuyến mãi) — cần đối chiếu. |
| **Platform-policy review** | **Bắt buộc** — người vận hành đối chiếu với chính sách chính thức của sàn, cập nhật pack. |
| **Operational** | Theo dõi `reviewDueAt`, xử lý khi overdue. |
