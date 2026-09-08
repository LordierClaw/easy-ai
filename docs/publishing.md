# Publish guide EasyAI v2

Mỗi mục nằm trong `guides/<id>/`, có `GUIDE.md` bắt buộc và các thư mục `references/`, `templates/`, `scripts/` tùy chọn. Frontmatter GUIDE chỉ chứa id, name, description, platform và actions. Xem hai mẫu trong `content/guides/` của repo ứng dụng.

AI đọc GUIDE trước khi kiểm tra nghiệp vụ. File script chỉ là tài liệu; việc chạy nội dung phải nằm trong kế hoạch được user xác nhận. Policy tổng quát khai báo trong `policy.json`: probes dùng query có executor cố định, rules tham chiếu probe, predicate và template hỗ trợ. Không đặt key, token hoặc dữ liệu cá nhân trong repo public.

Client dùng cố định `https://raw.githubusercontent.com/LordierClaw/easy-ai-docs/main/content/guides-manifest.json`. Manifest v2 chứa commit SHA và SHA256 từng file. File nằm ngoài thư mục guide, đường dẫn vượt thư mục, hash sai hoặc thiếu GUIDE đều bị từ chối. Phiên đang chạy giữ nguyên bundle; phiên mới nhận nội dung mới. Cache chỉ được dùng khi vẫn hợp lệ.

## Quy trình publish

Chạy từ repo ứng dụng:

```powershell
npm run docs:validate -- --repo D:\Code\easy-ai-docs
# Commit các file guides trong repo tài liệu, lấy full SHA của commit.
npm run docs:prepare -- <full-commit-sha> --repo D:\Code\easy-ai-docs
# Commit content/guides-manifest.json ở commit tiếp theo, rồi push cả hai.
```

Giữ nguyên `content/manifest.json` và revision v1 để client cũ tiếp tục đọc được. Không thay nội dung commit đã publish. Phiên v1 trong ứng dụng v2 chỉ xem/xuất được; tiếp tục bằng phiên v2 mới có liên kết lịch sử.

## Năng lực client

Query trước xác nhận: thông tin hệ thống, tìm executable/package, đọc file/registry và kiểm tra HTTP. Thay đổi sau xác nhận: ghi file có backup, chỉnh khóa TOML có backup, tải HTTPS có SHA256, chạy PowerShell hoặc tiến trình. Kế hoạch gồm bước cụ thể và tiêu chí kiểm chứng; tên thành phần là dữ liệu do guide/AI cung cấp.

Mẫu hỗ trợ có frontmatter `recipient`, `subject`; nội dung dùng `{{summary}}`, `{{request}}`, `{{attempts}}`, `{{nextSteps}}`, `{{reason}}`, `{{date}}`, `{{guide}}`. Người nhận phải có trong mẫu, không tự suy đoán. Bằng chứng kỹ thuật được tách khỏi email.

Thêm guide dùng các query/mutation/predicate hiện có không cần phát hành lại client. Thêm loại executor hoặc điều kiện mới cần sửa schema, executor và test. Hook chỉ đăng ký trong mã ứng dụng; guide không nạp plugin/extension. Utility Process và hook không phải sandbox hệ điều hành.
