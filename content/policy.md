---
recipient: lordierclaw@gmail.com
rules:
  - id: IT-001
    condition: missing_dependencies_without_admin
    effect: needs_it
    message: Git hoặc Node.js còn thiếu hoặc chưa phù hợp. Tài khoản hiện tại không có quyền quản trị. Gửi biểu mẫu BM01 cho IT để được hỗ trợ; không tự cài bản portable.
  - id: NET-001
    condition: openai_unreachable
    effect: needs_it
    message: Chưa kết nối được đến dịch vụ OpenAI cần thiết. Liên hệ IT để kiểm tra proxy, DNS và thông luồng mạng. Chưa đủ bằng chứng để kết luận nguyên nhân là chặn IP.
  - id: STORE-001
    condition: store_unavailable
    effect: needs_it
    message: Chưa cài được ChatGPT Desktop qua Microsoft Store. Nhờ IT kiểm tra chính sách Store hoặc triển khai ứng dụng được phê duyệt.
  - id: AUTH-001
    condition: login_required
    effect: awaiting_login
    message: Người dùng cần đăng nhập ChatGPT trong ứng dụng chính thức để tiếp tục kiểm tra.
---
# Quy định mẫu của doanh nghiệp
Những điều kiện trên được kiểm tra bằng mã trước khi cấp quyền thực thi. Người nhận hỗ trợ: lordierclaw@gmail.com.

Chỉ cài công cụ đã được duyệt. Không tự đổi proxy toàn Windows, firewall, chứng chỉ hoặc tắt kiểm tra TLS. Không yêu cầu mật khẩu/token trong chat. Lệnh AI không được vượt quyết định chặn của ứng dụng.

Sau khi IT xử lý, user bấm Kiểm tra lại. Việc kiểm tra lại không tự lặp các lệnh cài đã chạy. Quyền admin là khả năng nâng quyền của tài khoản; không đồng nghĩa EasyAI đang chạy elevated.
