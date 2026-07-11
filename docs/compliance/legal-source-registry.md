# Legal Source Registry — Baseline Management

> 🚨 **DISCLAIMER MẠNH — KHÔNG PHẢI TƯ VẤN PHÁP LÝ (NOT LEGAL ADVICE)** 🚨
>
> Tài liệu này và **toàn bộ bộ chính sách mẫu** đi kèm KHÔNG phải là ý kiến pháp lý, KHÔNG phải tư vấn luật, và KHÔNG thay thế việc tham vấn luật sư. Mọi tên luật/nghị định/quy định được liệt kê dưới đây chỉ là **danh mục lĩnh vực cần rà soát**, KHÔNG phải khẳng định nội dung luật hiện hành.
>
> **Mọi chính sách mẫu phải được một chuyên gia pháp lý có thẩm quyền rà soát và phê duyệt TRƯỚC KHI kích hoạt cho production.** Cho tới khi đó, mọi mẫu ở trạng thái **SAMPLE / NEEDS_LEGAL_REVIEW / NOT_FOR_PRODUCTION**.

---

## 1. Cách baseline pháp lý được quản lý

Mỗi policy có nguồn gốc pháp lý được lưu trong `legalMetadata` và đăng ký ở `data_source_registry` (qua `RegistryService`).

### 1.1 Metadata mỗi policy lưu

| Trường | Ý nghĩa |
|---|---|
| `name` | Tên văn bản/lĩnh vực. |
| `number` | Số hiệu (nếu có). |
| `scope` | Phạm vi áp dụng (ngành hàng, kênh, đối tượng). |
| `issueDate` | Ngày ban hành (theo nguồn, chưa thẩm định). |
| `effectiveDate` | Ngày hiệu lực (theo nguồn, chưa thẩm định). |
| `status` | Trạng thái theo nguồn (còn hiệu lực / đã thay thế…). |
| `source` | Nguồn tham chiếu. |
| `reviewDate` | Ngày rà soát pháp lý gần nhất (do con người điền). |
| `humanReviewRequired` | Cờ bắt buộc con người rà. |

> Các mốc ngày là **dữ liệu tham chiếu do người nhập**, hệ thống **không** tự xác thực chúng đúng luật.

### 1.2 Rule máy thực thi được vs. mục cần người rà

| Loại | Ví dụ | Ai xử lý |
|---|---|---|
| **Machine-enforceable** | "Không chứa cụm từ trong danh sách cấm", "batch ≤ N", "cần consent marketing" | `RuleEvaluatorService` (DSL) áp tự động. |
| **HUMAN_REVIEW_REQUIRED** | "Nội dung có phù hợp quy định quảng cáo ngành X không", "diễn giải điều khoản mơ hồ" | Đánh dấu, đẩy sang Approval/legal review; **hệ thống không tự kết luận**. |

Mọi mục `HUMAN_REVIEW_REQUIRED` **fail-closed**: nếu chưa có phán quyết con người → không tự cho qua ở hành động rủi ro.

---

## 2. Danh mục lĩnh vực cần rà soát (KHÔNG phải luật đã xác minh)

> ⚠️ Danh sách dưới đây là **các lĩnh vực (areas)** mà bộ chính sách mẫu chạm tới và **cần** chuyên gia pháp lý rà. Đây **KHÔNG** phải trích dẫn luật, **KHÔNG** khẳng định hiệu lực, số hiệu hay nội dung. Mỗi mục mặc định gắn nhãn **SAMPLE / NEEDS_LEGAL_REVIEW / NOT_FOR_PRODUCTION**.

| # | Lĩnh vực cần rà | Nhãn |
|---|---|---|
| 1 | Bảo vệ dữ liệu cá nhân (personal data protection) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 2 | Bảo vệ quyền lợi người tiêu dùng (consumer protection) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 3 | Thương mại điện tử (e-commerce) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 4 | Giao dịch điện tử (e-transactions) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 5 | Chống thư rác / tin nhắn rác (anti-spam) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 6 | Quảng cáo (advertising) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 7 | Sở hữu trí tuệ (intellectual property) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 8 | Thương mại/khuyến mại (commerce/promotion) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 9 | Giá/hóa đơn/thuế (price/invoice/tax) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 10 | Quy định sản phẩm theo ngành hàng (category-specific product rules) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |
| 11 | An ninh mạng (cybersecurity) | SAMPLE · NEEDS_LEGAL_REVIEW · NOT_FOR_PRODUCTION |

---

## 3. Nhãn trạng thái mẫu (sampleFlag)

| Nhãn | Ý nghĩa | Có được ACTIVE production? |
|---|---|---|
| `SAMPLE` | Chỉ để minh họa cấu trúc. | ⛔ Không |
| `NEEDS_LEGAL_REVIEW` | Chờ chuyên gia pháp lý rà. | ⛔ Không |
| `NOT_FOR_PRODUCTION` | Cấm dùng thật. | ⛔ Không |
| `REVIEWED` | Đã có luật sư rà + phê duyệt (kèm danh tính + ngày). | ✅ Có (theo quy trình) |

> Hệ thống **không** cho một policy chuyển sang `ACTIVE` cho môi trường production khi `sampleFlag` chưa phải `REVIEWED` và `humanReviewRequired` chưa được giải quyết. Đây là fail-closed ở tầng vòng đời policy.

---

## 4. Ranh giới trách nhiệm

| Lớp | Trong legal source registry |
|---|---|
| **Technical enforcement** | Áp machine-enforceable rules; chặn ACTIVE khi chưa REVIEWED; fail-closed cho HUMAN_REVIEW_REQUIRED. |
| **Business policy** | Chọn lĩnh vực nào áp cho ngành hàng của mình. |
| **Legal review** | **Bắt buộc** — chuyên gia pháp lý xác nhận nội dung, hiệu lực, số hiệu; đổi nhãn sang REVIEWED. |
| **Operational** | Theo dõi `reviewDate`, nhắc rà lại định kỳ. |

> Nhắc lại: **Không nơi nào trong hệ thống tuyên bố "đã tuân thủ pháp luật đầy đủ".** Trách nhiệm pháp lý cuối cùng thuộc về doanh nghiệp và cố vấn pháp lý của họ.
