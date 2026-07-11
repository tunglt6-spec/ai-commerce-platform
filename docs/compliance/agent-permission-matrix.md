# Agent Permission Matrix — Least-Privilege Defaults

> ⚠️ **NOT LEGAL ADVICE**: Ma trận quyền là **cấu hình kỹ thuật** theo nguyên tắc least-privilege. Nó không thay thế việc rà soát pháp lý/chính sách sàn cho từng hành động.

---

## 1. Nguyên tắc

- **Least privilege**: mỗi agent chỉ được cấp đúng quyền tối thiểu cho vai trò.
- **DB profile override code default**: `agent_permission_profiles` (DB) **ghi đè** giá trị mặc định trong code. Code default chỉ là fallback an toàn.
- **Unknown agent = read-only**: agent không có profile khớp → chỉ được đọc, mọi hành động khác coi như `DENIED`/`REQUIRE_APPROVAL` tùy risk. Đây là biểu hiện fail-closed (P3).
- **Ba nhóm quyền cho mỗi hành động**: `Allowed` (được phép thẳng), `Approval-required` (phải qua Approval Inbox), `Denied` (chặn).

---

## 2. Ma trận 8 agent

> Ký hiệu: ✅ Allowed · 🟡 Approval-required · ⛔ Denied. Cột "Limits" là giới hạn định lượng mặc định (DB có thể siết chặt hơn, không được nới lỏng vượt riskFloor policy).

| Agent | Allowed | Approval-required | Denied | Limits (default) |
|---|---|---|---|---|
| **Trend Hunter** | Đọc dữ liệu xu hướng công khai, tạo báo cáo nội bộ (DRAFT) | Gọi API bên thứ ba tốn phí | Đăng công khai, chạy quảng cáo, thanh toán | ≤ N call/nguồn/ngày; không side effect ngoài. |
| **Product** | Tạo/sửa nháp sản phẩm nội bộ, đề xuất mô tả | Publish sản phẩm lên sàn, đổi giá | Xóa sản phẩm hàng loạt, thanh toán | Đổi giá ≤ ±X% cần approval; batch ≤ M. |
| **Content** | Soạn nội dung nháp, sinh caption | Đăng bài công khai, gửi email marketing | Claim y tế/tài chính bị cấm, mạo danh thương hiệu | Đăng ≤ K bài/ngày qua approval; scan nội dung bắt buộc. |
| **Video** | Sinh video nháp, dựng preview | Đăng video công khai, dùng nhạc/tài sản bên thứ ba | Dùng tài sản không có `asset_rights_records`, deepfake người thật | Bắt buộc asset rights hợp lệ; nếu thiếu → BLOCK. |
| **Sales** | Đọc CRM, soạn kịch bản chào | Gửi tin nhắn/email tới khách, tạo ưu đãi | Cam kết giá/khuyến mãi vượt policy, spam hàng loạt | Tần suất outreach có trần; cần consent marketing. |
| **Fulfillment** | Đọc đơn, cập nhật trạng thái nội bộ | Gọi API vận chuyển, hoàn/hủy đơn | Chuyển tiền/hoàn tiền tự động, sửa sổ kế toán | Hoàn tiền = Risk-4 → luôn approval. |
| **Raving Fan** | Đọc feedback, soạn phản hồi nháp | Đăng phản hồi công khai, gửi voucher | Đăng thông tin cá nhân khách, cam kết bồi thường | Voucher có trần giá trị; PII redaction bắt buộc. |
| **Analyze** | Đọc & tổng hợp dữ liệu nội bộ, tạo dashboard | Xuất dữ liệu ra ngoài, chia sẻ báo cáo công khai | Truy cập dữ liệu ngoài scope, export PII thô | Read-only là mặc định; export cần approval + consent. |

> Các giá trị `N/X/M/K` là placeholder cấu hình — giá trị thực nằm trong `agent_permission_profiles` và policy `riskFloor`, do business + legal xác nhận.

---

## 3. Cách permission được áp trong pipeline

1. `AgentPermissionService` tra profile của agent (DB trước, code default sau).
2. Với `action.type` cụ thể → phân loại Allowed / Approval / Denied.
3. Kết quả là **một tín hiệu** đưa vào `PolicyGuardService`, cùng với Risk, Rule DSL, Content scan.
4. Quyết định cuối là mức **nghiêm ngặt nhất** trong các tín hiệu (ví dụ: permission cho Allowed nhưng Risk-4 → vẫn REQUIRE_APPROVAL). Không có tín hiệu nào được phép *nới lỏng* kết quả xuống dưới mức các tín hiệu khác yêu cầu.

> **Agent không thể tự sửa profile của mình (P6).** Chỉ vai trò quản trị (không phải agent runtime) mới ghi được `agent_permission_profiles`.

---

## 4. Ranh giới trách nhiệm

| Lớp | Trong permission matrix |
|---|---|
| **Technical enforcement** | Áp least-privilege, unknown→read-only, override DB. |
| **Business policy** | Chọn limit định lượng, agent nào được làm gì. |
| **Legal review** | Xác nhận các hành động Denied thật sự phải cấm (ví dụ claim, PII). |
| **Platform-policy review** | Trần tần suất đăng/quảng cáo theo luật sàn. |
| **Operational** | Cập nhật profile khi vai trò agent thay đổi. |
