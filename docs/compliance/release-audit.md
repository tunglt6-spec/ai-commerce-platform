# Release & Audit Process — Compliance Layer

> ⚠️ **NOT LEGAL ADVICE**: Tài liệu mô tả **quy trình kỹ thuật** để phát hành lớp compliance. "Audit" ở đây là kiểm thử/rà soát **kỹ thuật**, KHÔNG phải kiểm toán pháp lý.

---

## 1. Quy trình phát hành

```
DISCOVER ─► IMPLEMENT ─► TEST ─► PRE-AUDIT ─► INDEPENDENT AUDIT ─► FIX ─► DEPLOY ─► VERIFY
```

| Bước | Nội dung |
|---|---|
| **DISCOVER** | Xác định phạm vi: agent nào, action nào, nền tảng nào; liệt kê bất biến (P1–P9); nhận diện phần cần legal/platform review. |
| **IMPLEMENT** | Viết services (PolicyGuard, RuleEvaluator, RiskService…), migration additive `0003_compliance`, 12 màn UI. Tuân thủ bất biến. |
| **TEST** | Chạy các nhóm test (xem §2). Không tiến tiếp nếu có test đỏ ở nhóm security/enforcement. |
| **PRE-AUDIT** | Tự rà (self-audit): checklist bất biến, fail-closed paths, no-eval, no direct API. Soạn prompt audit đầy đủ. |
| **INDEPENDENT AUDIT** | Bên độc lập (reviewer/Codex/agent khác) rà lại, tìm lỗ hổng bỏ qua ở pre-audit. |
| **FIX** | Vá mọi phát hiện; ưu tiên HIGH (tenant leak, bypass gateway, self-approve, eval). |
| **DEPLOY** | Chạy migration additive; bật dần; giữ kill switch sẵn sàng. |
| **VERIFY** | Xác minh trên môi trường thật: enforcement đúng, log bất biến ghi nhận, kill switch chặn được. |

---

## 2. Nhóm test

| Nhóm | Mục tiêu | Ví dụ ca kiểm |
|---|---|---|
| **Unit** | Từng service đúng logic. | RuleEvaluator: operator lạ → `false`; `contains_none` khớp; so sánh sai kiểu → `false`. RiskService: Risk-4 luôn approval, Risk-5 luôn block; max-floor không pha loãng. |
| **Integration** | Các service phối hợp qua PolicyGuard. | Permission Allowed nhưng Risk-4 → REQUIRE_APPROVAL; unknown agent → read-only; pack overdue → auto-publish off. |
| **E2E** | Toàn pipeline từ proposal → adapter. | Approval + payload hash: đổi payload sau duyệt → INVALIDATED → re-evaluate; gateway re-validate chặn khi policy đổi giữa chừng; kill switch chặn execute. |
| **Security** | Chống bypass & lạm quyền. | Agent không gọi API trực tiếp (P1); không bypass gateway (P2); agent không tự sửa policy/permission (P6); không self-approve; no `eval` (P7); audit log không sửa/xóa được (P8); tenant isolation. |

> Quy tắc gating: **test security/enforcement đỏ = không deploy.** Fail-closed cả trong CI.

---

## 3. Trung thực: enforced vs. cần verify

> Phần này bắt buộc trung thực. Không phóng đại.

### ✅ Được thực thi về mặt kỹ thuật (technically enforced)

- Mọi side effect đi qua Execution Gateway; agent không gọi external API trực tiếp.
- Policy re-validate ngay trước execute; approval gắn payload hash + expiry; payload đổi → invalidate + re-evaluate.
- Least-privilege theo agent; unknown agent → read-only; DB profile override code default.
- Risk chấm điểm xác định; Risk-4 luôn approval; Risk-5 luôn block; LLM không phải nguồn quyết định duy nhất.
- RuleEvaluator không `eval`; operator lạ → fail-closed `false`.
- Kill switch chặn ở gateway; gateway failure raise incident.
- Audit log append-only, bất biến; migration additive, rollback an toàn.
- Policy không thể ACTIVE production khi chưa `REVIEWED`; pack overdue tự siết chế độ.

### ⚠️ Vẫn cần con người xác minh (NOT auto-guaranteed)

- **Tính hợp pháp** của nội dung/hành vi kinh doanh — cần **legal review** (`legal-review-checklist.md`). Bộ chính sách mẫu là `SAMPLE / NEEDS_LEGAL_REVIEW / NOT_FOR_PRODUCTION`.
- **Chính sách sàn/nền tảng** — cần **platform-policy review** đối chiếu chính sách chính thức; hệ thống không tự xác thực.
- **Độ đúng của rule kinh doanh** — DSL chỉ thực thi đúng cái được cấu hình; cấu hình sai vẫn sai.
- **Nghĩa vụ pháp lý phái sinh** (thông báo vi phạm dữ liệu…) — ngoài phạm vi hệ thống.

> **Tuyên bố trung thực**: Hệ thống đảm bảo *cơ chế enforcement kỹ thuật*, KHÔNG đảm bảo *tuân thủ pháp luật đầy đủ*. Trách nhiệm pháp lý cuối cùng thuộc doanh nghiệp và cố vấn pháp lý.

---

## 4. Ranh giới trách nhiệm

| Lớp | Trong release/audit |
|---|---|
| **Technical enforcement** | Test unit/integration/e2e/security, gating fail-closed, verify sau deploy. |
| **Business policy** | Duyệt phạm vi release, cấu hình rule. |
| **Legal review** | Xác nhận policy mẫu trước khi production (ngoài audit kỹ thuật). |
| **Platform-policy review** | Xác nhận pack sàn trước bật auto-publish/ad. |
| **Operational** | Deploy có kill switch, theo dõi sau VERIFY. |
