# Quy định doanh nghiệp

- Git/Node thiếu hoặc cần nâng phiên bản nhưng user không có quyền admin: yêu cầu IT cài bằng biểu mẫu, không dùng portable hoặc cài per-user để tránh quy định.
- Không truy cập được host OpenAI: nhờ IT kiểm tra DNS/proxy/TLS/luồng mạng bằng bằng chứng; không quy kết bị chặn IP từ mã HTTP hay lỗi đăng nhập.
- Store không khả dụng: ChatGPT Desktop cần IT; giữ các kết quả thành phần đã đạt.
- Chưa đăng nhập: trạng thái chờ user, chưa sẵn sàng.
- Không sửa proxy/firewall toàn Windows, không tắt TLS, không thu thập mật khẩu/MFA/token vào chat.
- Các probes và điều kiện chặn tối thiểu trong policy.json được executor đánh giá bằng dữ kiện thực. Hướng dẫn bằng văn bản vẫn là nguồn quyết định nghiệp vụ cho AI.
