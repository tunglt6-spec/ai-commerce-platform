# AI Governance & Compliance — Compliance & Policy Guard

> **Phạm vi tài liệu**: Bộ tài liệu này mô tả lớp **AI Governance & Compliance** của AI Commerce Platform (AI Teammate). Mục tiêu là kiểm soát mọi hành vi (side effect) của các AI Agent trước khi chúng chạm tới thế giới bên ngoài (đăng bài, chạy quảng cáo, gọi API sàn, thanh toán…).

> ⚠️ **KHÔNG PHẢI TƯ VẤN PHÁP LÝ (NOT LEGAL ADVICE)**: Tài liệu này và toàn bộ bộ chính sách mẫu đi kèm mang tính **kỹ thuật/vận hành**, KHÔNG phải ý kiến pháp lý. Mọi chính sách mẫu đều ở trạng thái **SAMPLE / NEEDS_LEGAL_REVIEW / NOT_FOR_PRODUCTION** cho tới khi được **chuyên gia pháp lý có thẩm quyền** rà soát và phê duyệt. Xem `legal-source-registry.md` và `legal-review-checklist.md`.

---

## 1. Mục đích (Purpose)

**Compliance & Policy Guard** là lớp thực thi (enforcement layer) đứng giữa các AI Agent và mọi hành động gây hậu quả thực tế. Nó tồn tại để trả lời một câu hỏi duy nhất trước mỗi hành động:

> "Agent này có được phép làm hành động này, với payload này, ngay tại thời điểm này không?"

Bốn cam kết cốt lõi:

| Cam kết | Ý nghĩa |
|---|---|
| **Least privilege** | Mỗi agent chỉ được cấp đúng quyền tối thiểu cần cho vai trò của nó. |
| **Fail-closed** | Khi không chắc chắn / lỗi / rủi ro cao → **chặn**, không cho qua. |
| **Everything auditable** | Mọi đề xuất, quyết định, phê duyệt, thực thi đều để lại dấu vết bất biến. |
| **Human-in-the-loop** | Hành động rủi ro cao (tài chính/pháp lý) luôn cần con người phê duyệt. |

Bốn lớp trách nhiệm được **tách bạch rõ ràng** trong toàn bộ tài liệu:

1. **Technical enforcement** — cái hệ thống thực sự chặn/cho qua bằng code.
2. **Business policy** — quy tắc kinh doanh do doanh nghiệp tự đặt.
3. **Legal review** — phần cần chuyên gia pháp lý xác nhận (KHÔNG do code quyết định).
4. **Platform-policy review** — chính sách của các sàn/nền tảng (TikTok, Meta, Shopee…), do con người rà soát.
5. **Operational responsibility** — trách nhiệm vận hành day-2 (kill switch, incident, audit export).

---

## 2. Pipeline thực thi (Enforcement Pipeline)

Mọi hành động có side effect **bắt buộc** đi qua đường ống sau. Agent **không bao giờ** gọi thẳng API bên ngoài.

```
AI Agent
   │  (đề xuất, không tự thực thi)
   ▼
Action Proposal            ── agent_action_proposals
   │
   ▼
Compliance Context         ── gom dữ liệu: agent, platform, payload, product,
   │                           consent, asset rights, policy freshness, evidence
   ▼
Policy Guard               ── PolicyGuardService điều phối
   │   ├─ RuleEvaluatorService   (safe JSON DSL, KHÔNG eval)
   │   ├─ ContentScannerService  (quét nội dung cấm/nhạy cảm/claim)
   │   ├─ RiskService            (chấm điểm rủi ro xác định — deterministic)
   │   └─ AgentPermissionService (kiểm tra quyền least-privilege)
   ▼
Policy Decision            ── policy_decision_records
   │   ALLOW / WARN / REQUIRE_APPROVAL / BLOCK
   │
   ├─ REQUIRE_APPROVAL ─► ApprovalService ─► Approval Inbox ─► (người duyệt)
   │                                             │
   │◄────────────────────────────────────────────┘ (đã duyệt + payload hash khớp)
   ▼
Execution Gateway          ── ExecutionGatewayService
   │   • RE-VALIDATE policy NGAY trước khi chạy (không tin quyết định cũ)
   │   • Kiểm KillSwitch
   │   • Kiểm approval còn hiệu lực + payload hash chưa đổi
   ▼
Adapter                    ── adapter sàn/nền tảng thật (TikTok, Meta, Shopee, email…)
   │
   ▼
Audit                      ── compliance_execution_receipts
                              immutable_compliance_audit_logs (append-only)
```

**Nguyên tắc bất biến của pipeline** (chi tiết trong `architecture.md`):

- Agent **không** gọi external API trực tiếp — luôn qua Execution Gateway.
- Policy được **re-validate ngay trước khi execute**, không dựa vào quyết định đã cũ.
- **Approval KHÔNG thay thế** kiểm tra policy — cả hai đều phải pass.
- Agent **không thể** tự sửa policy/permission của chính mình.
- **Fail-closed** cho rủi ro cao: lỗi hoặc thiếu dữ liệu → chặn.

---

## 3. 12 màn hình UI (routes dưới `/compliance`)

| # | Màn hình | Route | Mục đích |
|---|---|---|---|
| 1 | Compliance Dashboard | `/compliance` | Tổng quan: proposal chờ, decision gần đây, incident mở, kill switch đang bật, sức khỏe policy. |
| 2 | Policies | `/compliance/policies` | Danh sách CompliancePolicy, trạng thái, enforcementMode, version. |
| 3 | Policy Detail / Editor | `/compliance/policies/:id` | Xem/clone version, rule DSL, metadata pháp lý, lịch sử. |
| 4 | Rules Library | `/compliance/rules` | Thư viện compliance_rules tái sử dụng (safe JSON DSL). |
| 5 | Agent Permissions | `/compliance/agents` | Ma trận quyền 8 agent (allowed/approval/denied + limits). |
| 6 | Risk Model | `/compliance/risk` | 6 mức rủi ro + các yếu tố chấm điểm; mô phỏng thử. |
| 7 | Approval Inbox | `/compliance/approvals` | Hàng đợi phê duyệt, separation of duties, payload hash. |
| 8 | Action Proposals | `/compliance/proposals` | Nhật ký đề xuất hành động của agent + quyết định. |
| 9 | Decisions & Evidence | `/compliance/decisions` | policy_decision_records + evidence_records liên quan. |
| 10 | Platform Policy Packs | `/compliance/platform-packs` | Bản chính sách sàn/nền tảng, version, reviewDueAt. |
| 11 | Incidents | `/compliance/incidents` | Vòng đời sự cố, containment, root cause, corrective action. |
| 12 | Audit & Kill Switch | `/compliance/audit` | Log bất biến, export, và bảng điều khiển kill switch. |

> **Lưu ý UI vs enforcement**: UI chỉ là bề mặt quản trị. Việc chặn/cho qua thực tế do backend services quyết định (xem `architecture.md`). Thay đổi trên UI (ví dụ sửa policy) vẫn phải đi qua versioning và không có hiệu lực hồi tố lên các quyết định đã ghi.

---

## 4. Bản đồ tài liệu

| File | Nội dung |
|---|---|
| `README.md` | (tài liệu này) Tổng quan + pipeline + 12 màn hình. |
| `architecture.md` | Kiến trúc enforcement, nguyên tắc bất biến, services, 16 DB tables. |
| `policy-model.md` | Mô hình CompliancePolicy, status, enforcementMode, versioning, DSL grammar. |
| `agent-permission-matrix.md` | Ma trận quyền 8 agent theo least-privilege. |
| `risk-model.md` | 6 mức rủi ro + yếu tố chấm điểm xác định. |
| `legal-source-registry.md` | Quản lý baseline pháp lý + DISCLAIMER + danh mục cần rà. |
| `platform-policy-process.md` | Versioning/review platform policy packs. |
| `approval-workflow.md` | Approval Inbox, separation of duties, payload hash. |
| `incident-response.md` | Vòng đời sự cố + containment/root cause. |
| `operations-runbook.md` | Vận hành day-2 + rollback. |
| `legal-review-checklist.md` | Checklist cho chuyên gia pháp lý trước khi kích hoạt. |
| `release-audit.md` | Quy trình DISCOVER→…→VERIFY + trung thực enforced vs cần verify. |

---

## 5. Ranh giới trách nhiệm (đọc kỹ)

- ✅ **Hệ thống đảm bảo về mặt kỹ thuật**: mọi side effect đi qua gateway, policy được re-validate, agent bị chặn khỏi self-approve/self-edit, log bất biến.
- ⚠️ **Hệ thống KHÔNG đảm bảo**: tính hợp pháp của nội dung/hành vi kinh doanh. Bộ chính sách mẫu **chưa** được thẩm định pháp lý.
- 🧑‍⚖️ **Cần con người**: rà soát pháp lý, rà soát chính sách sàn, phê duyệt hành động rủi ro cao, xử lý sự cố.

> Không nơi nào trong hệ thống được tuyên bố "đã tuân thủ pháp luật đầy đủ". Mọi phát biểu liên quan pháp lý đều kèm caveat **not-legal-advice**.
