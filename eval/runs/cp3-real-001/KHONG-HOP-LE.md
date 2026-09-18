# cp3-real-001 — không dùng làm bằng chứng

Kiểm tra ngày 17/09/2026 cho thấy run này không phản ánh đúng lượt chạy:

- `manifest.json` ghi model `openai/gpt-4o-mini`; các run thực tế dùng `openai/gpt-5.6-terra` (giá trị mặc định viết cứng trong eval runner).
- `promptVersion`/`promptHash` là của prompt một-lời-gọi cũ (`revision-cp3@1`), không phải prompt pipeline (`revision-hieu@1`, `revision-phuong-an@1`).
- 17 case pipeline đều **dùng lại cache node** (tổng 1,2 s), manifest không ghi điều này.
- `commitSha` là `5177e1c` nhưng mã chạy khi đó chưa được commit.
- Các case eval bị trộn góp ý đã lưu trong studio (lỗi `storedFeedback`, đã sửa).
- H-01 rò rỉ thông tin cá nhân vì bước làm sạch chưa dò tên, ngày sinh, mã hồ sơ, địa chỉ (đã sửa).

Runner đã được sửa: eval gọi service với `useCache: false`, manifest lấy model/prompt/chế độ từ chính các run, ghi `cacheHits`, `workingTreeDirty`, `validAsEvidence`. Chạy lại sau khi commit vào thư mục mới (ví dụ `cp3-real-002`).
