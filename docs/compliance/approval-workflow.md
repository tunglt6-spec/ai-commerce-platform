# Approval Workflow — Inbox, Separation of Duties, Payload Binding

> ⚠️ **NOT LEGAL ADVICE**: Quy trình phê duyệt là **kiểm soát vận hành/kỹ thuật**. Việc một hành động được phê duyệt KHÔNG có nghĩa nó hợp pháp — approval và legal review là hai việc khác nhau.

---

## 1. Approval Inbox

`ApprovalService` tạo `compliance_approval_requests` khi một quyết định là `REQUIRE_APPROVAL`. Approval Inbox (`/compliance/approvals`) hiển thị:

| Cột | Nội dung |
|---|---|
| Proposal | Hành động agent đề xuất. |
| Agent / Platform | Ai đề xuất, chạm nền tảng nào. |
| Risk | Mức rủi ro (0–5). |
| Payload hash | Hash của payload đã khóa (xem §3). |
| Requester | Người/agent yêu cầu. |
| Expiry | Thời điểm hết hạn phê duyệt. |
| Status | `PENDING` / `APPROVED` / `REJECTED` / `EXPIRED` / `INVALIDATED`. |

---

## 2. Separation of duties (tách nhiệm)

> **Bất biến**: Người/agent thực hiện không được tự phê duyệt hành động của chính mình.

| Quy tắc | Chi tiết |
|---|---|
| **Agent không tự duyệt** | Agent đề xuất → **không** thể approve chính đề xuất đó (P6). |
| **Requester không tự duyệt Risk-4 tài chính** | Người tạo yêu cầu **không** được phê duyệt hành động tài chính Risk-4 do mình yêu cầu. |
| **Tối thiểu vai trò Manager** | Người duyệt phải có vai trò ≥ Manager. |
| **Emergency override** | Có đường override khẩn cấp nhưng cần **vai trò riêng** + **lý do** + **thời hạn (expiry)** + **audit bất biến**. Không phải đường tắt thường dùng. |

Emergency override được ghi riêng, gắn cờ, và luôn để lại dấu vết trong `immutable_compliance_audit_logs`. Override **không** vô hiệu hóa policy check (P5) — nó chỉ là con đường phê duyệt đặc biệt có kiểm soát.

---

## 3. Approval gắn với payload hash

> **Bất biến**: Approval ràng buộc với **hash của payload** tại thời điểm duyệt. Payload đổi = approval mất hiệu lực.

Luồng:

```
1. Tạo request → tính payload_hash = H(payload chuẩn hóa)
2. Người duyệt APPROVED cho đúng payload_hash + expiry
3. Trước khi execute (ExecutionGatewayService):
     • re-validate policy (P4)
     • kiểm approval: status APPROVED?  chưa hết expiry?
     • tính lại H(payload hiện tại) == payload_hash đã duyệt?
        - KHÁC → approval INVALIDATED → chặn → buộc RE-EVALUATE lại từ đầu
        - GIỐNG → cho phép tiếp
```

Hệ quả:

- **Payload change after approval invalidates it.** Bất kỳ thay đổi nào (đổi giá, đổi nội dung, đổi đối tượng) sau khi duyệt → hash lệch → approval bị vô hiệu → hành động phải qua PolicyGuard lại từ đầu.
- **Expiry**: approval quá hạn → `EXPIRED` → không dùng được, phải xin duyệt lại.
- **Approval không thay policy (P5)**: dù có approval hợp lệ + hash khớp, gateway vẫn re-validate policy; nếu policy hiện tại BLOCK → vẫn chặn.

---

## 4. Sơ đồ trạng thái approval

```
PENDING ─► APPROVED ─► (execute nếu hash khớp & còn hạn & policy pass)
   │           │
   │           ├─► INVALIDATED  (payload đổi sau khi duyệt)
   │           └─► EXPIRED      (quá expiry)
   ├─► REJECTED
   └─► EXPIRED
```

---

## 5. Ranh giới trách nhiệm

| Lớp | Trong approval workflow |
|---|---|
| **Technical enforcement** | Payload hash binding, expiry, invalidation, re-evaluate, chặn self-approve. |
| **Business policy** | Ngưỡng vai trò duyệt, ai được emergency override. |
| **Legal review** | Approval KHÔNG thay legal review; hành động Risk-4 pháp lý vẫn cần cố vấn. |
| **Operational** | Xử lý hàng đợi Inbox, dùng override đúng quy trình. |
