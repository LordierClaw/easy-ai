# Publish tài liệu doanh nghiệp

## Bộ tài liệu

- `content/codex.md`: YAML frontmatter + Markdown hướng dẫn.
- `content/policy.md`: policy có cấu trúc và hướng dẫn chung.
- `content/bm01.md`: biểu mẫu hỗ trợ với các trường `{{reason}}`, `{{time}}`, `{{runId}}`, `{{revision}}`, `{{components}}`, `{{evidence}}`, `{{steps}}`.
- `content/manifest.json`: manifest được tạo từ byte của tài liệu **đã commit**.
- `content/manifest.example.json`: ví dụ cấu trúc với placeholder rõ ràng; không dùng file này làm manifest chạy thật.

Repo tài liệu: https://github.com/LordierClaw/easy-ai-docs. Client dùng cố định https://raw.githubusercontent.com/LordierClaw/easy-ai-docs/main/content/manifest.json.

## Quy trình

1. Sửa và review ba file Markdown, chạy `npm run docs:validate -- --repo <đường-dẫn-checkout-easy-ai-docs>`.
2. Commit ba file vào repo GitHub public đã chọn. Không đưa API key hoặc token vào content.
3. Chạy `npm run docs:prepare -- <commit-SHA-40-ký-tự> --repo <đường-dẫn-checkout-easy-ai-docs>`. Script đọc đúng nội dung commit và tạo manifest với SHA256. Nó không tự commit/push.
4. Commit manifest ở commit tiếp theo rồi publish cả hai commit. Manifest trên nhánh ổn định trỏ về commit tài liệu ở bước 2; cách này tránh vòng phụ thuộc SHA tự tham chiếu.
5. Điền URL `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/content/manifest.json` vào `GITHUB_MANIFEST_URL` trong `src/main/config.ts`, rồi build.
6. Chạy app không có `--demo`/`--sample-content`; kiểm tra nguồn GitHub và revision ở panel bên phải. Tắt mạng và mở phiên mới để kiểm tra cache hợp lệ.

Mỗi phiên giữ nguyên bundle đã đọc, kể cả retry sau IT. Mở phiên mới để nhận tài liệu mới. Client kiểm tra HTTPS/raw GitHub, schema, số file, SHA256 và bốn điều kiện policy bắt buộc. Nếu không tải được bản mới, chỉ dùng cache còn khớp hash; nếu không có thì dừng. Không tải instruction từ URL do AI tự đề xuất.

## Năng lực hiện có

MVP có workflow Codex và các operation `inspect`, `install_component`, `configure_proxy`, `read_config`, `verify`, `ask_user`, `request_support`. Trong tác vụ sửa đã được duyệt và metadata cho phép, có thêm `reset_codex_provider` và `reinstall_codex`; tool sửa provider sao lưu file thật trước khi bỏ các khóa lựa chọn cấp gốc. Admin có thể sửa nội dung/quy định trong hợp đồng hiện có. Thêm loại phần mềm/operation mới cần mở rộng executor, schema và test; metadata không phải mã thực thi.

Nguồn cài được executor cố định: Git.Git/OpenJS.NodeJS.LTS qua winget (kiểm tra hash của nguồn), `@openai/codex` qua npm HTTPS (integrity của tarball) và ChatGPT qua Store ID `9NT1R1C2HH7J`. Không dùng URL tùy ý trong log hay hội thoại làm installer.

Chạy các lệnh npm từ repo easy-ai; tham số --repo chọn checkout easy-ai-docs. Đẩy commit tài liệu và manifest vào easy-ai-docs. Không cần build lại client khi chỉ đổi nội dung đúng schema.
