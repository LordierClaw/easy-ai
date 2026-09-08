# Engine GUIDE.md v2

Renderer dùng IPC có schema, không có Node/filesystem/key. Main quản lý trạng thái SQLite, nguồn tài liệu, policy, executor và notification. Pi chạy theo nhu cầu trong Utility Process với session mới không tự nạp instruction/extension cá nhân. GUIDE được đọc qua tool trước mọi query nghiệp vụ.

Kế hoạch đóng băng gồm các mutation và tiêu chí kiểm chứng. Chỉ step ID thuộc đúng hash scope đã duyệt được thực thi. Query kiểm tra trước xác nhận có executor cố định; PowerShell tùy ý luôn cần scope. Policy trong bundle được đánh giá lại trước thay đổi. Các kiểm chứng bắt buộc phải đạt; đăng nhập có bước user xác nhận và kiểm chứng phụ thuộc riêng.

## Hook

`Hooks` nhận handler nội bộ với các điểm `before_ai`, `after_ai`, `before_tool`, `after_tool`, `state_change`. Handler trả allow, deny hoặc confirm. Lỗi control hook chặn hành động; observer lỗi được ghi nhận. Quyết định deny ưu tiên hơn confirm. Yêu cầu confirm được gắn với payload chính xác, không cấp quyền bao quát. Hook và Utility Process không tạo sandbox Windows.

## Trace

SQLite chứa chỉ mục; thư mục trace từng phiên chứa `events.jsonl` và payload JSON riêng. Mỗi sự kiện có session/turn/request/tool-call ID khi tương ứng, revision, thời gian, input/output quan sát được và quyết định hook. Prompt thực được bắt ở SDK onPayload. Không ghi từng token thành bản sao cả phiên. Secret được lọc trước disk, IPC và export; file xác thực bị chặn bởi tool file.

Giữ mặc định 14 ngày/200 MB; chỉ dọn phiên đã kết thúc, cắt payload lớn và báo rõ khi không ghi được hoặc vượt ngân sách. UI mở trace theo phiên và xuất JSON gồm dữ liệu phiên cùng payload. Process output bị giới hạn được đánh dấu truncated.

## Khôi phục

Phiên đang chạy khi mở lại thành bị gián đoạn và thu hồi scope. AI nhận lịch sử, đọc lại GUIDE và kiểm tra hiện trạng. Không tự phát lại lệnh từ journal. Installer giữ khóa riêng; marker `installer-pending.json` tồn tại nếu quá thời gian hoặc mất tiến trình. Khi marker còn tồn tại, executor dừng thay đổi cho đến khi IT kiểm tra trạng thái thực và xử lý marker. Hủy installer không có nghĩa đã rollback.

## Notification và hỗ trợ

Thông báo native chỉ phát khi chuyển sang trạng thái cần chú ý, bấm mở đúng phiên. Event show/failed được ghi vào trace; Windows Focus Assist có thể ẩn toast dù hệ thống nhận yêu cầu. Chỉ báo trong app vẫn tồn tại.

Hai mẫu IT nằm trong guide Codex. User sửa người nhận/tiêu đề/nội dung, sao chép từng phần hoặc lưu Markdown. Bằng chứng riêng có thể mở rộng. Khi API lỗi dùng mẫu và dữ kiện đã biết; thiếu thông tin được nêu rõ, không tự gửi email.
