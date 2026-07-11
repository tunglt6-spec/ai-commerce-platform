# Operations Runbook — Day-2 Compliance Ops

> ⚠️ **NOT LEGAL ADVICE**: Runbook này là **hướng dẫn vận hành kỹ thuật**. Không thao tác nào ở đây tạo ra sự tuân thủ pháp lý; kích hoạt policy mẫu vẫn cần legal review (xem `legal-review-checklist.md`).

---

## 1. Kích hoạt / tạm dừng một policy

**Activate policy**
1. Mở `/compliance/policies/:id`.
2. Kiểm tiền đề: `sampleFlag = REVIEWED`, `humanReviewRequired` đã giải quyết. Nếu chưa → **không** activate (hệ thống chặn).
3. Chuyển `APPROVED → ACTIVE`. Ghi audit tự động.
4. Xác nhận enforcementMode + riskFloor đúng ý.

**Suspend policy**
1. Mở policy đang `ACTIVE`.
2. Chuyển `ACTIVE → SUSPENDED` (kèm lý do).
3. Từ thời điểm này policy ngừng enforce; hành động phụ thuộc nó rớt về mức an toàn hơn (fail-closed).

---

## 2. Tạo version policy mới

> Không sửa version ACTIVE. Luôn clone.

1. Mở policy `ACTIVE`, chọn **Clone new version** → tạo `version+1` ở `DRAFT`.
2. Sửa rule DSL / metadata trên DRAFT.
3. `DRAFT → UNDER_REVIEW → APPROVED` (qua review, gồm legal nếu `humanReviewRequired`).
4. `APPROVED → ACTIVE`: version cũ tự chuyển `SUPERSEDED`, set `supersedesId`.
5. Kiểm các `policy_decision_records` cũ vẫn trỏ version cũ (bất biến).

---

## 3. Rà soát platform pack

1. Mở `/compliance/platform-packs`, lọc pack có `reviewDueAt` sắp/đã quá hạn.
2. Nếu **overdue**: xác nhận hệ thống đã tự tắt auto-publish + auto-ad-launch và hạ risk floor.
3. Đối chiếu rule với chính sách chính thức của sàn (con người).
4. Tạo version mới nếu cần → set `reviewedBy` (người thật) + `reviewedAt` → `PUBLISHED`.
5. **Không** set verified nếu không có người rà (P: no fake verified).

---

## 4. Xử lý một approval

1. Mở `/compliance/approvals`, chọn request `PENDING`.
2. Kiểm separation of duties: bạn không phải requester (với Risk-4 tài chính), vai trò ≥ Manager.
3. Xem payload + payload hash + risk + evidence.
4. `APPROVED` hoặc `REJECTED` (kèm lý do).
5. Nhớ: nếu payload đổi sau khi duyệt → approval tự `INVALIDATED`, phải duyệt lại.

---

## 5. Kích hoạt kill switch

1. Mở `/compliance/audit` (khu kill switch) hoặc trang incident.
2. Chọn phạm vi: global / theo agent / theo platform / theo action type.
3. Bật switch (kèm lý do). Gateway kiểm switch **trước mỗi execute** → chặn ngay.
4. Ghi nhận: kill switch là biện pháp containment; thường gắn với một incident.
5. Tắt switch khi đã an toàn (kèm lý do), ghi audit.

---

## 6. Điều tra một incident

1. Mở `/compliance/incidents`, chọn incident `OPEN`.
2. `OPEN → INVESTIGATING`: xem proposal/decision/execution receipt liên quan.
3. Áp containment (kill switch, suspend policy/agent) → `CONTAINED`.
4. Điền `rootCause`, `correctiveActions`, `preventiveActions` → `RESOLVED`.
5. Tổng kết `lessonsLearned` → `CLOSED`.

---

## 7. Export audit

1. Mở `/compliance/audit`.
2. Chọn khoảng thời gian / agent / platform / action.
3. Export từ `immutable_compliance_audit_logs` + `compliance_execution_receipts` (append-only, không sửa được).
4. Dùng cho báo cáo nội bộ / rà soát / (nếu cần) cung cấp cho bên liên quan theo hướng dẫn pháp lý.

---

## 8. Rollback

> **Migration `0003_compliance` là additive** (chỉ thêm 16 bảng, không sửa/xóa schema cũ).

Cách rollback an toàn:

1. **Revert app version** về bản trước lớp compliance.
2. **Các bảng compliance có thể để lại** — vì additive, chúng không cản schema cũ hoạt động.
3. Không cần drop bảng để rollback ứng dụng; drop chỉ khi có quyết định dọn dẹp riêng, có backup.
4. Sau rollback: lưu ý các side effect khi *không* còn Policy Guard — cân nhắc tắt agent tự động cho tới khi khôi phục.

```
Rollback = revert app version   (khuyến nghị)
           tables can remain     (additive, an toàn)
           drop tables           (tùy chọn, cần backup + quyết định riêng)
```

---

## 9. Ranh giới trách nhiệm

| Lớp | Trong runbook |
|---|---|
| **Technical enforcement** | Hệ thống chặn activate policy chưa REVIEWED, tự siết khi pack overdue. |
| **Business policy** | Quyết định bật/tắt policy, ngưỡng kill switch. |
| **Legal review** | Điều kiện tiên quyết trước activate; không phải thao tác ops. |
| **Platform-policy review** | Rà pack với chính sách sàn. |
| **Operational** | **Toàn bộ runbook** thuộc trách nhiệm vận hành. |
