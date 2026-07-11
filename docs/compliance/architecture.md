# Enforcement Architecture — AI Governance & Compliance

> ⚠️ **NOT LEGAL ADVICE**: Tài liệu mô tả kiến trúc **kỹ thuật**. Nó nói về *cách hệ thống thực thi quy tắc*, KHÔNG khẳng định các quy tắc đó là đúng luật. Phần pháp lý xem `legal-source-registry.md`.

---

## 1. Nguyên tắc bất biến (Non-negotiable principles)

Đây là các bất biến kiến trúc. Bất kỳ thay đổi code nào vi phạm chúng đều bị coi là lỗi bảo mật/tuân thủ.

| # | Nguyên tắc | Lớp bảo vệ |
|---|---|---|
| P1 | **Agent không bao giờ gọi external API trực tiếp.** | Chỉ Execution Gateway giữ credential adapter; agent không có network egress tới sàn. |
| P2 | **Mọi side effect đi qua Execution Gateway.** | Adapter chỉ được gọi bởi `ExecutionGatewayService`, không export ra ngoài. |
| P3 | **Fail-closed cho rủi ro cao.** | Lỗi, timeout, thiếu context, unknown operator, unknown agent → mặc định BLOCK/READ_ONLY. |
| P4 | **Policy re-validate ngay trước execute.** | Gateway gọi lại PolicyGuard với payload hiện tại; không tin quyết định cũ. |
| P5 | **Approval KHÔNG thay thế policy check.** | Cả approval hợp lệ **và** policy pass mới được chạy. Thiếu một trong hai → chặn. |
| P6 | **Agent không tự sửa policy/permission của mình.** | Agent runtime không có quyền ghi lên `compliance_policies`, `agent_permission_profiles`, `compliance_kill_switches`. |
| P7 | **Không dùng `eval`.** | RuleEvaluatorService diễn giải một safe JSON DSL cây AST; không thực thi code động. |
| P8 | **Audit bất biến.** | `immutable_compliance_audit_logs` là append-only; không update/delete. |
| P9 | **LLM không phải nguồn quyết định rủi ro duy nhất.** | RiskService chấm điểm bằng yếu tố xác định; LLM chỉ là tín hiệu phụ, không tự BLOCK/ALLOW. |

---

## 2. Sơ đồ luồng thực thi

```
                    ┌─────────────────────────────────────────────┐
                    │                 AI Agent                     │
                    │  (đề xuất hành động — KHÔNG thực thi)         │
                    └───────────────────┬─────────────────────────┘
                                        │ Action Proposal
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │            PolicyGuardService                │  ◄── điều phối
                    │  1. ComplianceService: build context         │
                    │  2. AgentPermissionService: least-privilege  │
                    │  3. RuleEvaluatorService: safe DSL           │
                    │  4. ContentScannerService: nội dung          │
                    │  5. RiskService: điểm rủi ro (deterministic) │
                    └───────────────────┬─────────────────────────┘
                                        │ Policy Decision
                        ┌───────────────┼───────────────┐
                        ▼               ▼               ▼
                     ALLOW/WARN   REQUIRE_APPROVAL     BLOCK ─► dừng + audit
                        │               │
                        │               ▼
                        │        ApprovalService ─► Approval Inbox ─► người duyệt
                        │               │ (approved + payload hash)
                        └───────┬───────┘
                                ▼
                    ┌─────────────────────────────────────────────┐
                    │          ExecutionGatewayService             │
                    │  • KillSwitchService.check()                 │
                    │  • RE-VALIDATE policy (P4)                    │
                    │  • verify approval + payload hash (P5)        │
                    │  • gọi Adapter (P1/P2)                        │
                    │  • ghi execution_receipt + audit (P8)        │
                    └───────────────────┬─────────────────────────┘
                                        ▼
                                    Adapter thật
```

---

## 3. Backend modules / services

| Service | Trách nhiệm | Bất biến liên quan |
|---|---|---|
| **PolicyGuardService** | Điều phối toàn bộ quyết định: gom sub-check, tổng hợp ra `PolicyDecision`. Là *điểm ra quyết định duy nhất*. | P3, P5, P9 |
| **RuleEvaluatorService** | Diễn giải **safe JSON DSL** dạng cây (and/or/not/eq/…); KHÔNG `eval`; operator lạ → false (fail-closed). | P7, P3 |
| **ContentScannerService** | Quét payload nội dung: từ cấm, claim vượt mức (chữa bệnh, cam kết lợi nhuận…), dữ liệu nhạy cảm, thiếu disclosure quảng cáo. Kết quả là tín hiệu cho Risk/Rule. | P9 |
| **RiskService** | Chấm điểm rủi ro **xác định** từ nhiều yếu tố (xem `risk-model.md`), ánh xạ ra 6 mức. LLM chỉ là 1 tín hiệu, không tự quyết. | P3, P9 |
| **AgentPermissionService** | Áp least-privilege: đọc profile (DB override code default); unknown agent = read-only. | P6 |
| **KillSwitchService** | Bật/tắt khẩn cấp theo agent/platform/action/global. Gateway kiểm trước mỗi execute. | P3 |
| **ApprovalService** | Tạo/duyệt approval request, separation of duties, gắn payload hash + expiry. | P5 |
| **ExecutionGatewayService** | Cổng duy nhất tới adapter: re-validate policy, kiểm kill switch + approval, ghi receipt. | P1, P2, P4, P5 |
| **ComplianceAuditService** | Ghi log append-only, phục vụ export/truy vết; không cho sửa/xóa. | P8 |
| **ComplianceService** | Xây `Compliance Context`: gom agent, platform, product profile, consent, asset rights, policy freshness, evidence. | — |
| **RegistryService** | Quản `data_source_registry` + legal/platform metadata; đánh dấu HUMAN_REVIEW_REQUIRED và reviewDueAt. | — |

> **Điểm quan trọng**: `PolicyGuardService` và `ExecutionGatewayService` là **hai điểm nghẽn có chủ đích** (choke points). Không có đường vòng nào tới adapter mà bỏ qua chúng.

---

## 4. 16 bảng cơ sở dữ liệu (migration `0003_compliance`, additive)

| # | Bảng | Vai trò |
|---|---|---|
| 1 | `compliance_policies` | Bản ghi CompliancePolicy (có version, status, enforcementMode, metadata pháp lý). |
| 2 | `compliance_rules` | Rule DSL tái sử dụng (safe JSON), gắn vào policy. |
| 3 | `agent_permission_profiles` | Profile quyền theo agent (DB override code default). |
| 4 | `agent_action_proposals` | Nhật ký đề xuất hành động của agent. |
| 5 | `policy_decision_records` | Kết quả quyết định (ALLOW/WARN/REQUIRE_APPROVAL/BLOCK) + lý do. |
| 6 | `compliance_approval_requests` | Yêu cầu phê duyệt, payload hash, expiry, người duyệt. |
| 7 | `evidence_records` | Bằng chứng đính kèm (giấy tờ, chứng nhận, ảnh chụp, log). |
| 8 | `consent_records` | Bản ghi đồng ý (người dùng/khách/đối tác) cho hành vi dữ liệu/marketing. |
| 9 | `asset_rights_records` | Quyền sở hữu/sử dụng tài sản (ảnh, video, nhạc, thương hiệu). |
| 10 | `product_compliance_profiles` | Hồ sơ tuân thủ theo sản phẩm/ngành hàng (rule đặc thù). |
| 11 | `platform_policy_packs` | Gói chính sách nền tảng/sàn (version + reviewDueAt). |
| 12 | `data_source_registry` | Đăng ký nguồn dữ liệu + trạng thái review. |
| 13 | `compliance_incidents` | Sự cố tuân thủ (vòng đời OPEN→…→CLOSED). |
| 14 | `compliance_kill_switches` | Công tắc dừng khẩn cấp. |
| 15 | `compliance_execution_receipts` | Biên nhận thực thi qua gateway (input hash, kết quả adapter). |
| 16 | `immutable_compliance_audit_logs` | Log kiểm toán **append-only**, bất biến. |

> **Additive migration**: `0003_compliance` chỉ thêm bảng, không sửa/xóa schema cũ. Rollback = revert app version; các bảng có thể để lại (xem `operations-runbook.md`).

---

## 5. Tách bạch trách nhiệm trong kiến trúc

| Lớp | Ai chịu trách nhiệm | Hệ thống làm gì |
|---|---|---|
| **Technical enforcement** | Kỹ thuật/Platform team | Chặn/cho qua bằng code, log bất biến. |
| **Business policy** | Chủ doanh nghiệp | Định nghĩa rule DSL, limit, enforcementMode. |
| **Legal review** | Chuyên gia pháp lý | Xác nhận policy mẫu; đánh dấu HUMAN_REVIEW_REQUIRED. |
| **Platform-policy review** | Người vận hành marketing | Rà chính sách sàn, cập nhật platform pack. |
| **Operational** | Ops/On-call | Kill switch, incident, audit export. |

Hệ thống **chỉ** đảm bảo lớp *technical enforcement*. Bốn lớp còn lại cần con người.
