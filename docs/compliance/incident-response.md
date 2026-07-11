# Incident Response — Compliance Incidents

> ⚠️ **NOT LEGAL ADVICE**: Quy trình sự cố là **kiểm soát vận hành**. Một số sự cố có thể kéo theo nghĩa vụ pháp lý (thông báo vi phạm dữ liệu…) — những nghĩa vụ đó cần cố vấn pháp lý, ngoài phạm vi hệ thống.

---

## 1. Vòng đời sự cố (Incident lifecycle)

`compliance_incidents` theo vòng đời:

```
OPEN ─► INVESTIGATING ─► CONTAINED ─► RESOLVED ─► CLOSED
```

| Trạng thái | Ý nghĩa |
|---|---|
| `OPEN` | Sự cố vừa được ghi nhận/tạo. |
| `INVESTIGATING` | Đang điều tra nguyên nhân, phạm vi ảnh hưởng. |
| `CONTAINED` | Đã khống chế (ví dụ bật kill switch, chặn action/agent). |
| `RESOLVED` | Đã khắc phục nguyên nhân + hành động sửa chữa. |
| `CLOSED` | Đóng, có báo cáo tổng kết + bài học. |

> Mỗi chuyển trạng thái ghi audit bất biến (`immutable_compliance_audit_logs`).

---

## 2. Gateway failure raise incident

> **Bất biến**: Lỗi ở Execution Gateway **tự động nâng** một incident thay vì âm thầm bỏ qua (fail-closed).

Các trường hợp gateway raise incident:

| Tình huống | Hành xử |
|---|---|
| Adapter trả lỗi/không xác định | Ghi `execution_receipt` lỗi → tạo incident `OPEN`. |
| Re-validate policy fail ngay trước execute | Chặn + tạo incident nếu là bất thường (ví dụ policy vừa BLOCK giữa chừng). |
| Approval invalidated bất thường / hash lệch nghi ngờ | Chặn + tạo incident để điều tra. |
| Kill switch chặn nhưng có luồng cố vượt | Tạo incident an ninh. |
| Timeout / mất kết nối adapter khi Risk cao | Fail-closed: không retry mù, tạo incident. |

Ý tưởng: **không có side-effect lỗi nào biến mất im lặng**. Gateway luôn để lại receipt + (khi cần) incident.

---

## 3. Các trường của incident

| Nhóm | Trường | Mô tả |
|---|---|---|
| Nhận diện | `id`, `title`, `severity`, `openedAt`, `openedBy` | Thông tin cơ bản. |
| Liên kết | `proposalId`, `decisionId`, `executionReceiptId`, `agent`, `platform` | Truy vết về nguồn gốc. |
| **Containment** | `containmentActions`, `killSwitchRef`, `containedAt` | Biện pháp khống chế đã áp (kill switch, suspend policy/agent). |
| **Root cause** | `rootCause`, `rootCauseCategory` | Nguyên nhân gốc sau điều tra. |
| **Corrective action** | `correctiveActions`, `preventiveActions`, `resolvedAt` | Hành động sửa chữa + phòng ngừa tái diễn. |
| Đóng | `closedAt`, `closedBy`, `lessonsLearned` | Tổng kết. |

---

## 4. Liên kết với các kiểm soát khác

- **Kill switch** (`KillSwitchService`): công cụ containment chính; incident thường tham chiếu kill switch đã bật.
- **Risk model**: lịch sử incident là yếu tố #12 — sự cố cũ nâng rủi ro tương lai của agent/platform/action liên quan.
- **Audit**: mọi thao tác trong incident nằm trong log bất biến, phục vụ export/điều tra.

---

## 5. Ranh giới trách nhiệm

| Lớp | Trong incident response |
|---|---|
| **Technical enforcement** | Gateway raise incident, ghi receipt, không nuốt lỗi im lặng. |
| **Business policy** | Định nghĩa severity, ngưỡng leo thang. |
| **Legal review** | Nghĩa vụ thông báo vi phạm (nếu có) — cần cố vấn pháp lý, ngoài hệ thống. |
| **Platform-policy review** | Sự cố vi phạm chính sách sàn → phối hợp cập nhật pack. |
| **Operational** | **Bắt buộc** — điều tra, containment, root cause, corrective action, đóng sự cố. |
