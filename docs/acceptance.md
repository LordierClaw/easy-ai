# Ma trận nghiệm thu EasyAI MVP

Tài liệu này phân biệt mã đã có, kết quả test và điều kiện nghiệm thu còn thiếu. Không coi demo hoặc lệnh kích hoạt test thành công là bằng chứng cài phần mềm thật thành công.

| Yêu cầu | Cách triển khai / bằng chứng | Trạng thái |
|---|---|---|
| Chat-first, ba nhu cầu, danh mục Codex, tiến trình và xác nhận | React/assistant-ui, E2E cửa sổ Electron | Đã có; chạy trong suite e2e |
| Pi SDK trong Utility Process, streaming và tool call | `probe:ai`, `test:live`; model kr/glm-5 theo thay đổi của user | Đã chạy thành công; chạy lại sau thay đổi runtime |
| Thiếu Git/Node, không admin → BM01, không cài portable | `policy.ts`, engine gate; unit + E2E no-admin | Đã kiểm chứng bằng fixture; còn ca user thật trong VM |
| Mạng OpenAI không thông → bằng chứng và chuyển IT | HTTP transport/error phân biệt; unit + E2E network | Đã kiểm chứng fixture; còn proxy Windows thật trong VM |
| Một lần xác nhận và kiểm tra phạm vi ngay trước mutation | approvedComponents, fresh inspection, serialized tool queue | Unit kiểm tra thay đổi quyền/phạm vi và tool song song |
| Cài Git/Node nếu phù hợp quyền | winget với hash verification mặc định, installer lock | Mã đã có; chưa nghiệm thu UAC/installer trên Win10/11 |
| Cài Codex CLI, ChatGPT Desktop | npm prefix riêng, Store ID chính thức | Mã đã có; chưa nghiệm thu installer/Store thật |
| Cấu hình/sửa lỗi | Launcher proxy Windows, backup, sửa lựa chọn provider TOML, cài lại CLI | Unit sửa file thật trong thư mục test; còn ca công cụ thật trên VM |
| Không báo ready chỉ từ lời AI | Independent verify, CLI login status + smoke request, user xác nhận ChatGPT | Đã kiểm chứng engine/E2E; còn login thật có user |
| Hủy, crash, resume | Abort, chờ installer, file lock qua process, SQLite recovery | Unit process/state + E2E; còn crash installer thật trong VM |
| Tài liệu ghim revision + hash/cache | Manifest raw GitHub, schema, SHA256, cache fail-closed | Unit fixture/cache và Electron tải GitHub thật + cache khi ngắt request đều đạt |
| BM01, đính kèm log, copy, export, redaction | Preload IPC và native dialog, file/clipboard trong E2E | Đã kiểm chứng; không tự gửi email |
| Proxy Electron | Chromium isolated session + HTTP proxy thật trên loopback | Test chứng minh request qua proxy; không thay thế đọc registry Windows/CONNECT trong guest |
| Nhận diện Windows thực | `scripts/probe-windows.ts`, native PowerShell tests | Đã chạy trên Windows 11 host; chưa chạy Windows 10 guest |
| Setup và Portable | electron-builder, packaged smoke | Build cả hai đạt; 3 test khớp ASAR, demo unpacked và mở Portable đạt; cài Setup thật còn chờ VM |
| Lab điều khiển từ host | vmrun/SSH/task interactive, tunnel API, artifacts | Script và hướng dẫn đã có; cần VMX và SSH thực |

## Các gate để được coi là hoàn tất

1. Tất cả `typecheck`, `docs:validate`, `test`, `test:e2e`, `test:live`, `dist`, `test:packaged` đạt trên đúng mã bàn giao.
2. Đã publish LordierClaw/easy-ai-docs; build với URL thật, xác nhận online/cache trên app.
3. Có hai VMware guest Win10/Win11; chạy baseline standard-missing, standard-ready, admin-clean và các ca proxy/Store/lỗi/hủy theo `vm-lab.md`.
4. User hoàn thành UAC, đăng nhập/MFA và xác nhận hoạt động ChatGPT Desktop; Codex CLI smoke test đạt.
5. Thu artifact có thời điểm, OS, version app/model/tài liệu. Không có dữ liệu auth trong log/trace/báo cáo.

Hai repo GitHub đã được publish và URL thật đã được kiểm chứng. Theo yêu cầu, dừng trước test VM để chờ user cài VMware guest; chưa có VMX/SSH. Vì thế chưa thể khẳng định hoàn thành toàn bộ nghiệm thu MVP, dù các gate local đã đạt từng phần. Không thay các gate này bằng demo.

## Kiểm chứng host ngày 2026-09-07

- Typecheck/build và validator tài liệu: đạt.
- 25 unit/integration, 9 E2E, 3 live (Pi/API thật, hủy, GitHub/cache), 3 packaged: đạt.
- npm audit --omit=dev: 0 lỗ hổng được báo cáo.
- Script lab parse bằng Windows PowerShell 5: đạt; chưa thực thi trên guest.
- Tài liệu ghim commit 46af46088a37ae35f50a39b8b03388731176cb83 trong LordierClaw/easy-ai-docs.
- Báo cáo JSON, screenshot và trace lưu cục bộ dưới artifacts/; binary test dưới release/. Không publish binary chứa key test lên repo public.
- Không cài hoặc sửa Git/Node/Codex/ChatGPT trên host. Dừng ở ranh giới VM theo yêu cầu của user.
