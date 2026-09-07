# VMware lab cho EasyAI

## Chuẩn bị

Trên host cài VMware Workstation Pro, tạo Windows 11 x64 và Windows 10 22H2 x64 bằng ISO có giấy phép phù hợp. Mỗi guest: 4 vCPU, 8 GB RAM, disk thin 80 GB, VMware Tools. Dùng network host-only cho điều khiển; proxy lab trên host cung cấp Internet khi test mạng bắt buộc qua proxy. Không nối bridge vào mạng sản xuất.

Tạo tài khoản admin để chuẩn bị và `easyai-test` standard user để nghiệm thu. Đăng nhập desktop bằng tài khoản test khi chạy GUI. Không bật autologin hoặc lưu mật khẩu vào repo. Không dùng snapshot có session ChatGPT đã đăng nhập làm baseline chia sẻ.

Chưa có VMX/SSH thật được cung cấp trong phiên triển khai. Các script dưới đây không được coi là đã nghiệm thu trên guest cho đến khi chạy và thu artifact.

## Build và chuyển test harness

1. Trên host: `npm ci`, `npm run build`, chạy Electron demo một lần để bảo đảm binary đã tải.
2. Chạy `scripts/vm/Build-LabBundle.ps1`. Script tạo thư mục staging dưới `artifacts/`, bao gồm app đã build, dependency test và Node riêng trong `runtime/`.
3. Chép nội dung staging vào `C:\EasyAI-Lab` của guest bằng shared folder chỉ dùng chuyển file, hoặc SCP. Không thêm `runtime/` vào PATH, không cài Node/Git global chỉ để chạy harness.
4. Trong guest, chạy elevated: `powershell -File C:\EasyAI-Lab\scripts\vm\Setup-Guest.ps1 -TestUser easyai-test -HostOnlySubnet <CIDR-host-only>`.
5. Tạo key SSH trên host bằng `ssh-keygen`. Thêm public key vào `%USERPROFILE%\.ssh\authorized_keys` của test user, đặt ACL theo OpenSSH Windows. Với account thuộc Administrators, OpenSSH mặc định dùng `C:\ProgramData\ssh\administrators_authorized_keys`; đặt ACL chỉ SYSTEM/Administrators. Private key chỉ nằm trên host.
6. Đăng nhập SSH lần đầu thủ công và kiểm tra fingerprint. Script không tắt kiểm tra host key.
7. Sao chép `lab.example.json` thành file riêng ngoài repo hoặc dưới `.local/`, sửa đường dẫn VMX, vmrun, SSH key, host và tên snapshot.

## Điều khiển từ host

```powershell
.\scripts\vm\Invoke-Lab.ps1 -Config .local\lab.json -Action Check
.\scripts\vm\Invoke-Lab.ps1 -Config .local\lab.json -Action Start
.\scripts\vm\Invoke-Lab.ps1 -Config .local\lab.json -Action Snapshot
.\scripts\vm\Invoke-Lab.ps1 -Config .local\lab.json -Action Tunnel
```

Tunnel chạy ở terminal riêng: guest `127.0.0.1:20128` chuyển tới API của host. Nó không expose API lên toàn mạng guest. Runner GUI là Scheduled Task dùng **interactive token của test user**, không phải service/Session 0. User phải đang đăng nhập; với UAC/login giữ cửa sổ VM mở để thao tác.

```powershell
.\scripts\vm\Invoke-Lab.ps1 -Config .local\lab.json -Action Run -Suite e2e
.\scripts\vm\Invoke-Lab.ps1 -Config .local\lab.json -Action Run -Suite live
.\scripts\vm\Invoke-Lab.ps1 -Config .local\lab.json -Action Collect
```

Chỉ coi một lần chạy xong khi `C:\EasyAI-Lab\artifacts\status.json` có `completed=true`. `exitCode=0` mới là pass. Lệnh kích hoạt task thành công không chứng minh test thành công. Artifact gồm log, ảnh, báo cáo và trace theo suite.

Suite `real` chạy installer thật, có chặn kiểm tra model máy VMware và cờ `EASYAI_REAL_VM`. Mặc định yêu cầu cài đủ bộ, chờ user xử lý UAC và đăng nhập. Để test baseline chặn, đặt `EASYAI_VM_EXPECT=standard-missing` hoặc `network-blocked` trong môi trường task trước khi chạy. Bản sample và bundle GitHub thật là hai ca riêng; suite real hiện dùng sample đã ghi rõ trên UI.

## Proxy bắt buộc

Trên host, đặt `EASYAI_PROXY_BIND` bằng IP host-only và chạy `npx tsx scripts/vm/proxy.ts`. Chỉ cho subnet guest truy cập cổng proxy trong firewall host. Proxy không ghi nội dung request/credential; log CONNECT nằm ở `artifacts/proxy.jsonl`.

Trong guest test, chạy `Set-ProxyLab.ps1 -ProxyHost <IP-host-only> -RestrictEgress` với quyền phù hợp. Script sao lưu cấu hình, chỉ hoạt động trong VMware, vô hiệu allow-rule outbound hiện có của **lab** rồi chỉ cho proxy/loopback. Chạy dưới danh tính test user để HKCU đúng; đối với standard user, admin đặt firewall riêng và user đặt proxy không có `-RestrictEgress` trên baseline khác. Chụp snapshot trước thao tác.

Kiểm chứng hai phía: yêu cầu HTTPS trực tiếp thất bại và request qua proxy có log CONNECT, trong khi API loopback vẫn chạy. Muốn mô phỏng OpenAI bị chặn, restart proxy với `EASYAI_PROXY_BLOCK=chatgpt.com,openai.com`. Không bỏ TLS verification. `-Restore` khôi phục backup hoặc khôi phục snapshot sau khi thu artifact.

## Snapshot và nghiệm thu

- `easyai-standard-missing`: thiếu dependency, không admin → BM01 IT-001, không cài portable.
- `easyai-standard-ready`: Git/Node do IT cài → không cài lại dependency.
- `easyai-admin-clean`: account có khả năng UAC, EasyAI chạy non-elevated → cài đủ bộ.
- Ca mạng/Store bị chặn; cấu hình sai; hủy/crash giữa tác vụ; restart rồi kiểm tra lại.
- Chạy từng ca trên cả Win10/Win11, lưu version OS, tài liệu, app, model và thời điểm.

Để tôi hỗ trợ từ host: cung cấp file cấu hình lab, SSH hoạt động và phiên desktop test đã đăng nhập. Tôi có thể chạy task, lấy artifacts, xem screenshot/trace và sửa mã; user xử lý secure desktop UAC và tài khoản ChatGPT. Script snapshot chỉ chấp nhận VMX nằm trong labRoot chuyên dụng và tên có tiền tố `easyai-`.
