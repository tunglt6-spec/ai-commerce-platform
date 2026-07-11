# Policy Model — CompliancePolicy & Safe Rule DSL

> ⚠️ **NOT LEGAL ADVICE**: Mô hình policy là **cơ chế kỹ thuật** để mã hóa quy tắc kinh doanh và baseline pháp lý *đã được con người xác nhận*. Bản thân mô hình không làm cho một rule trở nên đúng luật. Xem `legal-source-registry.md`.

---

## 1. CompliancePolicy — các trường (fields)

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | uuid | Khóa chính. |
| `key` | string | Định danh logic ổn định (không đổi giữa các version). |
| `version` | int | Số phiên bản tăng dần; mỗi thay đổi = version mới. |
| `name` | string | Tên hiển thị. |
| `description` | text | Diễn giải mục đích. |
| `scope` | enum | Phạm vi áp dụng: `GLOBAL` / `PLATFORM` / `PRODUCT_CATEGORY` / `AGENT` / `ACTION_TYPE`. |
| `status` | enum | Vòng đời (xem §2). |
| `enforcementMode` | enum | Mức thực thi (xem §3). |
| `rules` | json[] | Danh sách rule DSL (safe JSON, xem §5) hoặc tham chiếu `compliance_rules`. |
| `riskFloor` | int | Mức rủi ro tối thiểu áp cho hành động khớp policy (0–5). |
| `legalMetadata` | json | name/number/scope/issueDate/effectiveDate/status/source/reviewDate + `humanReviewRequired`. |
| `platformPackRef` | uuid? | Liên kết `platform_policy_packs` nếu là chính sách sàn. |
| `reviewDueAt` | timestamp? | Hạn rà soát; quá hạn → siết chế độ (xem `platform-policy-process.md`). |
| `sampleFlag` | enum | `SAMPLE` / `NEEDS_LEGAL_REVIEW` / `NOT_FOR_PRODUCTION` / `REVIEWED`. |
| `createdBy` / `approvedBy` | uuid | Người tạo / người phê duyệt (không được trùng nhau ở Risk-4). |
| `supersedesId` | uuid? | Trỏ tới version bị thay thế. |
| `createdAt` / `activatedAt` / `expiresAt` | timestamp | Mốc thời gian. |

---

## 2. Vòng đời trạng thái (Status lifecycle)

```
DRAFT ─► UNDER_REVIEW ─► APPROVED ─► ACTIVE ─► SUSPENDED ──┐
                                        │        ▲          │
                                        │        └──────────┘ (re-activate)
                                        ▼
                                     EXPIRED
                                        │
                            SUPERSEDED ◄┘ (khi có version mới ACTIVE)
                                        │
                                        ▼
                                     ARCHIVED
```

| Status | Ý nghĩa | Có enforce? |
|---|---|---|
| `DRAFT` | Đang soạn, chưa hiệu lực. | Không |
| `UNDER_REVIEW` | Đang chờ rà (business + legal nếu cần). | Không |
| `APPROVED` | Đã duyệt nhưng chưa bật. | Không |
| `ACTIVE` | Đang thực thi. | **Có** |
| `SUSPENDED` | Tạm dừng (có thể do kill switch/incident). | Không |
| `EXPIRED` | Hết hạn theo `expiresAt`. | Không |
| `SUPERSEDED` | Bị version mới thay thế. | Không |
| `ARCHIVED` | Lưu trữ, chỉ để tra cứu. | Không |

> **Chuyển trạng thái đều được ghi audit bất biến.** Không có đường tắt DRAFT → ACTIVE bỏ qua review.

---

## 3. enforcementMode

| Mode | Hành vi khi rule khớp | Dùng khi |
|---|---|---|
| `ADVISORY` | Chỉ ghi nhận, không cản. | Đang quan sát/thử nghiệm rule mới. |
| `WARN` | Cho qua nhưng cảnh báo + audit. | Rủi ro thấp, cần nhắc nhở. |
| `REQUIRE_APPROVAL` | Chặn cho tới khi có phê duyệt hợp lệ. | Hành động rủi ro trung bình/cao. |
| `BLOCK` | Chặn tuyệt đối, không có đường qua. | Hành vi bị cấm / rủi ro cực cao. |

> **Fail-closed**: nếu không xác định được mode (config lỗi/thiếu) → xử như `REQUIRE_APPROVAL` hoặc `BLOCK` tùy riskFloor, không bao giờ tự nới lỏng thành ADVISORY.

---

## 4. Versioning — KHÔNG bao giờ sửa version ACTIVE

Quy tắc bất biến:

> **Một version ở trạng thái `ACTIVE` là bất biến. Muốn thay đổi → clone sang version mới.**

Lý do: các `policy_decision_records` đã ghi phải trỏ chính xác tới nội dung policy tại thời điểm quyết định. Sửa tại chỗ sẽ phá tính truy vết.

Quy trình đổi policy:

1. Clone version ACTIVE → version mới (`version + 1`, status `DRAFT`).
2. Sửa trên version DRAFT.
3. `DRAFT → UNDER_REVIEW → APPROVED`.
4. Khi `ACTIVE`: version cũ chuyển `SUPERSEDED`, `supersedesId` được set.
5. Quyết định cũ vẫn tham chiếu version cũ (bất biến).

---

## 5. Safe Rule DSL — ngữ pháp

Rule là **cây JSON** được `RuleEvaluatorService` diễn giải. **KHÔNG dùng `eval`**, không thực thi code động. Mỗi node = một operator + toán hạng.

### 5.1 Bộ operator

| Nhóm | Operator | Ý nghĩa |
|---|---|---|
| Logic | `and`, `or`, `not` | Tổ hợp boolean. |
| So sánh | `eq`, `ne`, `gt`, `gte`, `lt`, `lte` | Bằng/khác/lớn/nhỏ. |
| Tập hợp | `in`, `nin` | Thuộc / không thuộc danh sách. |
| Tồn tại | `exists`, `missing` | Trường có / không có giá trị. |
| Chân trị | `truthy`, `falsy` | Giá trị đúng / sai theo nghĩa boolean. |
| Chuỗi/mảng | `contains_any`, `contains_none` | Chứa ít nhất một / không chứa phần tử nào trong tập. |
| Hằng | `always`, `never` | Luôn true / luôn false. |

> **Unknown operator → fail closed to `false`.** Operator không nằm trong danh sách trên **không** được coi là true; luôn trả `false` (an toàn theo chiều chặn).

### 5.2 Cú pháp node

```json
{
  "op": "and",
  "args": [
    { "op": "eq", "field": "action.type", "value": "PUBLISH_POST" },
    { "op": "in", "field": "context.platform", "value": ["tiktok", "meta"] },
    { "op": "contains_none", "field": "content.claims", "value": ["chữa bệnh", "cam kết lợi nhuận"] },
    { "op": "truthy", "field": "context.consent.marketing" }
  ]
}
```

### 5.3 Ví dụ fail-closed

```json
{ "op": "spawn_shell", "cmd": "rm -rf /" }
```

`spawn_shell` không có trong bộ operator hợp lệ → evaluator trả **`false`**, node coi như không khớp; không có bất kỳ thực thi nào xảy ra. Đây là biểu hiện của nguyên tắc **P7 (no eval)** và **P3 (fail-closed)**.

### 5.4 Ràng buộc an toàn của evaluator

- Chỉ đọc field từ context đã whitelist; không truy cập global/process/fs.
- Độ sâu cây giới hạn (chống DoS đệ quy).
- Kiểu dữ liệu không khớp (so sánh số với chuỗi rác) → `false`, không throw ra ngoài làm crash pipeline (fail-closed).
- Kết quả evaluator là **tín hiệu** cho PolicyGuard; quyết định cuối vẫn tổng hợp cùng Risk + Permission + Content scan.

---

## 6. Ranh giới trách nhiệm

| Lớp | Trong policy model |
|---|---|
| **Technical enforcement** | Evaluator diễn giải DSL, versioning bất biến, fail-closed. |
| **Business policy** | Nội dung rule, riskFloor, enforcementMode do doanh nghiệp đặt. |
| **Legal review** | `legalMetadata.humanReviewRequired`, `sampleFlag` — chuyên gia pháp lý xác nhận. |
| **Operational** | Chuyển status, suspend, clone version. |
