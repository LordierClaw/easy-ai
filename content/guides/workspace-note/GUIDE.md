---
id: workspace-note
name: Tạo ghi chú làm việc
description: Tạo file ghi chú trong vùng làm việc riêng và kiểm chứng nội dung; không cài phần mềm.
platform: win32-x64
actions: [install, configure, repair]
---
# Tạo ghi chú làm việc

Không cần Git, Node, Codex hay kiểm tra phần mềm khác. Sau khi đọc GUIDE.md, dùng system_info để biết workspace. Đọc `references/note.md` để biết nội dung cần ghi.

Đề xuất một kế hoạch gồm một bước write_file tới `{workspace}/welcome.txt`, nội dung chính xác `EASYAI_OK`. Tool tự backup nếu file đã có. Dùng một check read_file cùng đường dẫn, expect field content equals EASYAI_OK. Xin xác nhận kế hoạch trước khi ghi.

Sau xác nhận: đọc GUIDE.md lại để tiếp tục đúng hướng dẫn, execute_step với ID đã duyệt rồi finish để kiểm chứng độc lập. Nếu bước đã hoàn tất, không chạy lại. Chỉ báo sẵn sàng khi check đạt.
