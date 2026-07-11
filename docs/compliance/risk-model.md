# Risk Model — Deterministic Risk Scoring

> ⚠️ **NOT LEGAL ADVICE**: Mô hình rủi ro là **cơ chế kỹ thuật xác định (deterministic)** để phân loại hành động. Nó KHÔNG phán xét tính hợp pháp; hành vi được chấm rủi ro thấp vẫn có thể cần rà soát pháp lý.

---

## 1. Sáu mức rủi ro (Risk levels 0–5)

| Level | Tên | Ý nghĩa | Xử lý mặc định |
|---|---|---|---|
| **0** | `READ_ONLY` | Chỉ đọc, không thay đổi gì. | Cho qua (ALLOW). |
| **1** | `DRAFT_ONLY` | Tạo/sửa nháp nội bộ, chưa công khai. | Cho qua, ghi audit. |
| **2** | `REVERSIBLE_INTERNAL` | Thay đổi nội bộ có thể hoàn tác. | ALLOW/WARN tùy policy. |
| **3** | `EXTERNAL_PUBLIC` | Chạm thế giới bên ngoài / công khai (đăng bài, gửi tin, gọi API sàn). | Thường REQUIRE_APPROVAL. |
| **4** | `FINANCIAL_OR_LEGAL` | Ảnh hưởng tài chính hoặc pháp lý (thanh toán, hoàn tiền, hợp đồng, claim). | **Luôn REQUIRE_APPROVAL** (không có ngoại lệ). |
| **5** | `PROHIBITED` | Hành vi bị cấm. | **Luôn BLOCK** (không có đường qua). |

> **Bất biến**: Risk-4 **luôn** cần phê duyệt con người; Risk-5 **luôn** bị chặn. Không policy/permission/approval nào hạ được hai mức này.

---

## 2. Chấm điểm xác định (Deterministic scoring)

`RiskService` tính điểm từ các **yếu tố xác định**, rồi ánh xạ ra level. Cùng input → cùng output (tái lập được, audit được).

| # | Yếu tố | Ảnh hưởng |
|---|---|---|
| 1 | **Action type** | Bản chất hành động (đọc/nháp/publish/thanh toán). Nền tảng của level. |
| 2 | **Platform** | Sàn/kênh (nội bộ vs công khai; sàn có rủi ro chính sách cao hơn). |
| 3 | **Data sensitivity** | Mức nhạy cảm dữ liệu chạm tới (PII, dữ liệu tài chính). |
| 4 | **Claims** | Nội dung có claim rủi ro (y tế, cam kết lợi nhuận, so sánh sai) → tăng mạnh. |
| 5 | **Asset ownership** | Có `asset_rights_records` hợp lệ cho ảnh/video/nhạc không; thiếu → tăng rủi ro. |
| 6 | **Financial impact** | Có dòng tiền/nghĩa vụ tài chính → đẩy về Risk-4. |
| 7 | **Batch size** | Số lượng đối tượng tác động (đăng 1 vs 10.000) → tăng theo quy mô. |
| 8 | **Agent permission** | Hành động có nằm trong quyền least-privilege của agent không. |
| 9 | **Policy freshness** | Policy/pack liên quan còn hạn (`reviewDueAt`) hay quá hạn → quá hạn tăng rủi ro. |
| 10 | **Evidence completeness** | Bằng chứng (`evidence_records`) đủ chưa (giấy phép, chứng nhận). |
| 11 | **Consent** | Có `consent_records` phù hợp cho hành vi dữ liệu/marketing không. |
| 12 | **Historical incidents** | Lịch sử sự cố của agent/platform/action → tăng rủi ro nếu từng vi phạm. |

### 2.1 Cách tổng hợp

- Mỗi yếu tố đóng góp điểm/nâng sàn (floor) theo bảng cấu hình xác định.
- Level cuối = **max** giữa: level suy từ action type, `riskFloor` của policy khớp, và các floor do yếu tố nâng lên. Không lấy trung bình để tránh "pha loãng" rủi ro.
- Thiếu dữ liệu để chấm một yếu tố quan trọng → **fail-closed**: nâng rủi ro thay vì giả định an toàn.

---

## 3. LLM KHÔNG phải nguồn quyết định duy nhất

> **Bất biến P9**: LLM **không bao giờ** là nguồn duy nhất của một quyết định rủi ro.

- Điểm rủi ro do các yếu tố **xác định** ở §2 quyết định.
- LLM/ContentScanner có thể cung cấp **tín hiệu phụ** (ví dụ: gợi ý một câu có thể là claim y tế), nhưng tín hiệu đó chỉ **nâng** rủi ro để con người xem, **không tự** hạ rủi ro hay tự ALLOW.
- Nếu LLM không khả dụng/timeout → hệ thống vẫn chấm được rủi ro bằng yếu tố xác định (fail-closed nếu thiếu).

---

## 4. Ví dụ minh họa (không phải cấu hình thật)

| Tình huống | Yếu tố nổi bật | Level | Xử lý |
|---|---|---|---|
| Analyze đọc dashboard nội bộ | action=read, platform=internal | 0 | ALLOW |
| Content soạn caption nháp | action=draft | 1 | ALLOW + audit |
| Product publish 1 sản phẩm lên sàn | action=publish, platform=public | 3 | REQUIRE_APPROVAL |
| Content đăng bài chứa "cam kết lợi nhuận 20%" | claims=financial | 4 | REQUIRE_APPROVAL |
| Fulfillment hoàn tiền cho khách | financial impact | 4 | REQUIRE_APPROVAL (luôn) |
| Video dùng nhạc không có quyền | asset ownership thiếu | ≥4/5 | BLOCK/APPROVAL |
| Hành vi trong danh sách cấm | action=prohibited | 5 | BLOCK (luôn) |

---

## 5. Ranh giới trách nhiệm

| Lớp | Trong risk model |
|---|---|
| **Technical enforcement** | Chấm điểm xác định, max-floor, fail-closed, Risk-4/5 cứng. |
| **Business policy** | Ngưỡng điểm, trọng số yếu tố, batch limit. |
| **Legal review** | Xác nhận claim nào là Risk-4/5; ngành hàng nào nhạy cảm. |
| **Platform-policy review** | Rủi ro theo chính sách từng sàn. |
| **Operational** | Xem lịch sử incident, cập nhật freshness. |
