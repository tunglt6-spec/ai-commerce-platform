# Legal Review Checklist — Trước khi kích hoạt policy mẫu cho production

> 🚨 **DISCLAIMER — NOT LEGAL ADVICE**: Checklist này là **công cụ hỗ trợ** cho chuyên gia pháp lý/tuân thủ, KHÔNG phải tư vấn pháp lý và KHÔNG đầy đủ cho mọi ngành hàng/khu vực. Việc hoàn thành checklist **không** tự động tạo ra sự tuân thủ. Chuyên gia có thẩm quyền phải tự đánh giá và chịu trách nhiệm cuối cùng.

**Đối tượng dùng**: luật sư / chuyên viên pháp chế / cán bộ tuân thủ được ủy quyền.
**Điều kiện**: chạy checklist này cho **từng** policy mẫu **trước khi** đổi `sampleFlag` sang `REVIEWED` và cho phép `ACTIVE` trên production.

---

## 1. Tiền đề (Pre-conditions)

- [ ] Đã xác định rõ **khu vực tài phán (jurisdiction)** áp dụng.
- [ ] Đã xác định **ngành hàng / loại sản phẩm** và các quy định đặc thù.
- [ ] Đã có bản **văn bản luật/nguồn chính thức** để đối chiếu (không dựa vào metadata do người nhập).
- [ ] Đã xác nhận `legalMetadata` (name/number/issueDate/effectiveDate/status/source) khớp nguồn chính thức.

---

## 2. Đối chiếu nội dung policy

- [ ] Mỗi rule DSL **machine-enforceable** phản ánh đúng yêu cầu pháp lý (không quá rộng, không quá hẹp).
- [ ] Các mục **HUMAN_REVIEW_REQUIRED** đã được nhận diện đầy đủ và có quy trình xử lý con người.
- [ ] `enforcementMode` phù hợp mức độ ràng buộc pháp lý (ví dụ: yêu cầu bắt buộc → `BLOCK`/`REQUIRE_APPROVAL`, không phải `ADVISORY`).
- [ ] `riskFloor` không hạ thấp hơn mức mà rủi ro pháp lý đòi hỏi.

---

## 3. Theo lĩnh vực (rà từng mục liên quan)

> Chỉ tick những mục áp dụng cho ngành hàng/khu vực của bạn. Đây là **lĩnh vực cần rà**, không phải khẳng định luật.

- [ ] **Bảo vệ dữ liệu cá nhân** — cơ sở pháp lý xử lý dữ liệu, consent, quyền chủ thể dữ liệu, lưu trữ/chuyển giao.
- [ ] **Bảo vệ người tiêu dùng** — thông tin bắt buộc, điều khoản không công bằng, đổi/trả.
- [ ] **Thương mại điện tử** — nghĩa vụ thông tin người bán, quy trình giao kết.
- [ ] **Giao dịch điện tử** — giá trị pháp lý chữ ký/chứng từ điện tử.
- [ ] **Chống thư rác** — consent marketing, cơ chế từ chối nhận, tần suất.
- [ ] **Quảng cáo** — nội dung cấm, disclosure, so sánh, chứng cứ cho claim.
- [ ] **Sở hữu trí tuệ** — quyền dùng hình ảnh/nhạc/nhãn hiệu (`asset_rights_records`).
- [ ] **Thương mại/khuyến mại** — điều kiện, hạn mức, đăng ký (nếu có).
- [ ] **Giá / hóa đơn / thuế** — niêm yết giá, xuất hóa đơn, nghĩa vụ thuế.
- [ ] **Quy định sản phẩm theo ngành** — hàng hạn chế/điều kiện, ghi nhãn, chứng nhận.
- [ ] **An ninh mạng** — nghĩa vụ bảo mật, lưu trữ, thông báo sự cố.

---

## 4. Bằng chứng & consent

- [ ] `evidence_records` yêu cầu (giấy phép, chứng nhận) đã được định nghĩa cho hành động rủi ro.
- [ ] `consent_records` bắt buộc đúng chỗ (marketing, dữ liệu).
- [ ] `asset_rights_records` bắt buộc cho nội dung dùng tài sản bên thứ ba.

---

## 5. Quyết định & ký duyệt

- [ ] Xác nhận **không** có tuyên bố "đã tuân thủ pháp luật đầy đủ" ở bất kỳ đâu.
- [ ] Ghi rõ **phạm vi và giới hạn** của lần rà này (jurisdiction, ngày, ngành hàng).
- [ ] Điền `reviewDate`, đặt lịch rà lại (`reviewDueAt`).
- [ ] Người rà (danh tính + vai trò) xác nhận → đổi `sampleFlag` sang `REVIEWED`.
- [ ] Chỉ sau khi tất cả trên hoàn tất, cho phép chuyển policy sang `ACTIVE` cho production.

---

## 6. Ranh giới trách nhiệm

| Lớp | Trong checklist |
|---|---|
| **Technical enforcement** | Hệ thống chặn ACTIVE khi chưa `REVIEWED`; lưu bằng chứng rà. |
| **Business policy** | Cung cấp bối cảnh kinh doanh cho người rà. |
| **Legal review** | **Toàn bộ checklist** thuộc trách nhiệm chuyên gia pháp lý. |
| **Operational** | Nhắc lịch rà lại, lưu hồ sơ. |

> Nhắc lại: hoàn thành checklist **không** thay thế phán quyết chuyên môn của người có thẩm quyền, và **không** tạo ra bảo đảm pháp lý nào.
