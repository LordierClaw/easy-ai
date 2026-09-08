# EasyAI 0.2 — AI thực thi theo GUIDE.md

Ứng dụng Windows tiếng Việt: chọn guide → AI đọc hướng dẫn → kiểm tra → xác nhận phạm vi → thực hiện → kiểm chứng. Danh mục và quy định đến từ repo public easy-ai-docs; engine không cố định danh sách phần mềm.

## Phát triển và kiểm thử

Máy phát triển cần Node.js 24 và npm. Đặt key test trong `.local/ai-key.txt` (được gitignore), sau đó:

```powershell
npm ci
npm run docs:validate
npm test
npm run test:e2e
npm run test:live
npm run dist
npm run test:packaged
```

AI cố định `kr/glm-5`, API `http://localhost:20128/v1`; key được đưa vào main/utility lúc build, không vào renderer hoặc tài liệu public. Bản build dùng riêng cho môi trường test đã thống nhất.

`npx electron out/main/index.js --demo` dùng AI/tool fixture. `--demo-live-ai` dùng Pi/API thật và tool fixture. Chạy không có cờ để tải guide GitHub và dùng executor Windows thật. `--sample-content` dùng tài liệu mẫu với thao tác thật, chỉ dùng trong môi trường test có kiểm soát.

Setup per-user và Portable nằm trong `release/`. Portable vẫn lưu dữ liệu trong AppData. Chưa ký mã hoặc tự cập nhật. Mạng dùng proxy cố định Windows; loopback API đi trực tiếp. Không tắt TLS; PAC và proxy yêu cầu đăng nhập tương tác chưa thuộc phạm vi hỗ trợ.

## Tài liệu

- [Publish guide](docs/publishing.md)
- [Kiến trúc, trace và khôi phục](docs/guide-v2.md)
- [Báo cáo kiểm thử](docs/acceptance.md)
- [VMware lab](docs/vm-lab.md)

User xác nhận kế hoạch cụ thể trước thay đổi; scope mở rộng cần xác nhận lại. AI không tự gửi email hoặc xử lý mật khẩu/MFA. Phiên cũ được giữ để xem/xuất, tiếp tục bằng phiên mới. Đợt phát triển v2 chỉ kiểm thử local; user nghiệm thu cài mới trên VM.
