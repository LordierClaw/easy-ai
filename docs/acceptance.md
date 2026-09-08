# Báo cáo local EasyAI 0.2.0

Ngày kiểm tra: 2026-09-08. Host Windows 11 x64. Đợt này không chạy VM và không cài Git/Node/Codex/ChatGPT lên host.

| Gate | Kết quả |
|---|---|
| Typecheck/build | Đạt |
| Unit/integration | 28/28 đạt: GUIDE/path/hash/cache, scope/policy/hooks, verify, repair limit, redaction/retention, notification, backup/TOML, v1 history, crash/installer timeout |
| Electron E2E | 7/7 đạt: guide thứ hai, hoạt động, xác nhận, form IT, phản hồi, hủy, export và proxy transport |
| GitHub thật/cache offline | 1/1 đạt trên Electron; revision guide 44ea1ef775a7119ef1684ddb12c531c4292cdc7b |
| Dependency audit production | 0 vulnerabilities |
| Pi/API thật | Chưa đạt prerequisite: ECONNREFUSED 127.0.0.1:20128. Cần mở lại API kr/glm-5 rồi chạy test:live |
| Setup per-user | Đã cài qua UI local và mở được ứng dụng |
| Setup/Portable cuối cùng | Đạt 3/3: ASAR khớp build, demo đóng gói, Portable khởi chạy |
| Toast Windows trực tiếp | Chưa xác minh được toast hiện trên desktop; bản đóng gói nhận event show của Windows cho awaiting_approval và ready; unit dedup/click đạt; có chẩn đoán show/failed/no acknowledgment |

Artifact trong `artifacts/`: e2e-results.json, published-results.json, live-results.json, packaged-results.json, packaging-v2.log và thư mục screenshot/trace tương ứng. Không dùng kết quả v1 làm bằng chứng v2.

Engine v2 chỉ đọc GUIDE được ghim trước query nghiệp vụ; không còn engine Codex cố định. Hai guide có thư mục độc lập. Query trước xác nhận có executor cố định; arbitrary shell cần scope. Chuyển trạng thái sẵn sàng dựa trên kiểm chứng độc lập. Phiên cũ giữ nguyên để xuất và chỉ tiếp tục bằng phiên v2 mới.

Giới hạn nghiệm thu: mock không chứng minh installer/UAC/Store/đăng nhập thực. Các ca đó do user chạy lại trên VM sau khi gate AI thật được hoàn tất. API hiện không hoạt động nên chưa tuyên bố hoàn tất toàn bộ kế hoạch.
