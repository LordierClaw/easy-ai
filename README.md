# EasyAI MVP

Ứng dụng Windows hỗ trợ cài đặt, cấu hình và sửa lỗi công cụ theo Markdown + metadata do doanh nghiệp publish. Ca đầu tiên: Git, Node.js, Codex CLI và ChatGPT Desktop.

## Phát triển

Yêu cầu trên **máy phát triển**: Node.js 24 và npm. Máy nhân viên không cần Node để chạy EasyAI.

```powershell
# Tạo .local/ai-key.txt chứa key test được cấp (không commit file này).
npm ci
npm run build
npx electron out/main/index.js --demo
```

`--demo` mô phỏng toàn bộ thao tác Windows, không cài hoặc cấu hình phần mềm thật. Để thử AI thật với thao tác Windows vẫn mô phỏng:

```powershell
npx electron out/main/index.js --demo-live-ai
```

AI dùng `kr/glm-5` tại `http://localhost:20128/v1`. Cấu hình test cố định ở `src/main/config.ts`; không có UI đổi provider. Key đọc từ `.local/ai-key.txt` khi build và được nhúng cố định ở phía main/utility, không nằm trong renderer hoặc tài liệu publish. Bản test phân phối có chứa cấu hình test này; chỉ dùng trong môi trường test đã thống nhất.

`npm run dev` chạy ứng dụng chế độ bình thường, tải tài liệu từ LordierClaw/easy-ai-docs và yêu cầu xác nhận trước khi thay đổi máy. Tải binary Electron lần đầu có thể lâu; hoàn tất tải trước khi chạy E2E.

## Kiểm thử

```powershell
npm run typecheck
npm run docs:validate
npm test
npm run test:e2e
npm run probe:ai
npm run test:live
```

- Unit/integration: policy, giữ tài liệu theo revision, cache, SQLite, proxy, bảo vệ dữ liệu và máy trạng thái.
- E2E: cửa sổ Electron thật, tool Windows và AI mô phỏng.
- Live: Pi SDK thật trong Utility Process, API thật, cửa sổ Electron thật; thao tác Windows vẫn mô phỏng.
- VMware: cài phần mềm thật và đăng nhập có người tham gia, xem [hướng dẫn lab](docs/vm-lab.md).

Các test mô phỏng không thay thế nghiệm thu installer/Store/UAC/đăng nhập thật trên Windows 10/11. Trạng thái nghiệm thu được ghi trong [ma trận yêu cầu](docs/acceptance.md).

## Đóng gói

```powershell
npm run dist
```

Setup per-user và Portable nằm trong `release/`. Bản Portable vẫn lưu dữ liệu user trong AppData (không hứa chế độ mang toàn bộ dữ liệu trên USB). Bản v1 chưa có code signing hoặc auto-update.

## Tài liệu doanh nghiệp

[Hướng dẫn publish](docs/publishing.md) mô tả quy trình commit tài liệu, tạo manifest có SHA256 và ghim revision, publish GitHub public rồi điền URL raw cố định trước khi build.

Tài liệu mẫu nằm trong `content/`. `--sample-content` cho phép **thao tác thật với tài liệu mẫu**, chỉ chạy trong VM dành cho test. UI luôn ghi rõ mode. Dữ liệu demo, sample và bình thường tách riêng.

## Ranh giới v1

Ứng dụng không tự gửi email hoặc nhận mật khẩu/MFA trong chat. User xác nhận phạm vi một lần, tự đăng nhập trên ứng dụng chính thức. Thiếu Git/Node và không có quyền admin luôn chuyển IT với BM01; không tự cài portable để vượt quy định.

AI gọi các tool nghiệp vụ có kiểm tra bằng mã, chạy PowerShell phía executor. Không expose shell tùy ý cho renderer. Lỗi chưa có thao tác sửa phù hợp sẽ chuyển IT. Utility Process là tách tiến trình, không phải sandbox hệ điều hành.

Chỉ hỗ trợ Windows 10 22H2/11 x64, proxy cố định theo Windows; PAC, xác thực proxy tương tác và CA riêng chưa được nghiệm thu. Không tự bỏ kiểm tra TLS hoặc sửa proxy/firewall của máy nhân viên.
