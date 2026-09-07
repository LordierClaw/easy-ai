# EasyAI — Product & Technical Overview

## 1. Tổng quan ý tưởng

**EasyAI** là một ứng dụng desktop dành cho doanh nghiệp, ưu tiên triển khai trên **Windows**, với mục tiêu giúp nhân viên có thể tiếp cận và sử dụng các công cụ AI mạnh một cách đơn giản, an toàn và có quản trị tập trung.

EasyAI không cố gắng xây dựng lại một AI agent/harness mới. Thay vào đó, EasyAI đóng vai trò là một lớp:

- giao diện sử dụng AI đơn giản cho nhân viên;
- hướng dẫn người mới sử dụng AI;
- đóng gói các công việc lặp lại thành workflow có AI hỗ trợ;
- cài đặt và cấu hình các công cụ AI đã được doanh nghiệp phê duyệt;
- quản lý runtime, dependency và môi trường chạy;
- áp dụng policy, quyền hạn và guardrail;
- kết nối các AI agent/harness có sẵn như Pi Agent và có thể mở rộng sang các agent khác trong tương lai.

Mục tiêu cốt lõi của EasyAI là:

> Biến các công cụ AI mạnh nhưng khó triển khai thành một năng lực dễ sử dụng, dễ cài đặt, dễ quản lý và có thể phổ cập trong doanh nghiệp.

---

## 2. Bối cảnh và vấn đề cần giải quyết

Các công cụ AI hiện nay có năng lực rất mạnh nhưng thường tồn tại nhiều rào cản khi triển khai trong doanh nghiệp:

- Người dùng không phải lập trình viên thường không biết bắt đầu từ đâu.
- Một ô chat trống khiến người mới không biết nên hỏi AI như thế nào.
- Nhiều công cụ yêu cầu cài Node.js, Python, Git, Bash hoặc các dependency khác.
- Máy doanh nghiệp có thể không có quyền Administrator.
- Hệ thống mạng có thể sử dụng proxy, whitelist IP hoặc chính sách hạn chế truy cập.
- Việc mỗi nhân viên tự cài đặt và tự cấu hình công cụ tạo ra rủi ro về bảo mật và khó quản lý.
- Các AI tool bên ngoài thay đổi rất nhanh, khiến việc tự xây một harness mới trở nên tốn kém và khó theo kịp.
- Máy nhân viên có thể có cấu hình thấp nên ứng dụng cần hạn chế tiêu thụ RAM, CPU và tài nguyên nền.

EasyAI được thiết kế để giải quyết đồng thời các vấn đề trên.

---

## 3. Định vị sản phẩm

EasyAI không phải là:

- một chatbot tổng quát đơn thuần;
- một bản clone ChatGPT;
- một IDE mới;
- một AI coding agent mới;
- một focus/work management application;
- một hệ thống tự xây lại toàn bộ agent runtime.

EasyAI là một **AI Enablement Platform cho doanh nghiệp**, tập trung vào ba lớp chính:

1. **AI Experience**
   - Giao diện chat đơn giản.
   - Hướng dẫn người dùng theo nhu cầu.
   - Workflow được cấu hình sẵn.
   - Có thể hỏi đáp tự do.

2. **AI Runtime & Tool Enablement**
   - Chạy Pi Agent và các AI runtime khác.
   - Cài đặt tool.
   - Quản lý dependency.
   - Cung cấp tool cho agent.
   - Đóng gói workflow.

3. **Enterprise Governance**
   - Tool catalog.
   - Policy.
   - Permission.
   - Version.
   - Package.
   - Logging.
   - Security guardrail.

---

# 4. Đối tượng sử dụng

## 4.1. Nhân viên

Đây là nhóm người dùng chính.

EasyAI cần được thiết kế với giả định rằng người dùng:

- không biết Node.js;
- không biết Python;
- không biết biến môi trường;
- không muốn sử dụng terminal;
- không hiểu cách cấu hình proxy;
- có thể chưa từng sử dụng AI một cách bài bản.

Người dùng chỉ cần:

1. mở EasyAI;
2. chọn nhu cầu;
3. làm theo hướng dẫn hoặc tiếp tục chat;
4. để EasyAI xử lý phần kỹ thuật phía sau.

---

## 4.2. Admin / IT / AI Enablement Team

Admin chịu trách nhiệm:

- lựa chọn công cụ AI được phép sử dụng;
- publish tool và workflow;
- định nghĩa policy;
- cấu hình runtime;
- quản lý package;
- giới hạn quyền của agent;
- thiết lập endpoint/proxy;
- theo dõi lỗi;
- quản lý version;
- kiểm soát deployment.

Nhân viên không cần nhìn thấy phần lớn các cấu hình này.

---

# 5. Các nguyên tắc thiết kế chính

## 5.1. Chat-first

EasyAI mở trực tiếp vào giao diện chat.

Không yêu cầu người dùng phải đi qua dashboard phức tạp trước khi sử dụng AI.

---

## 5.2. Guided-first nhưng không khóa người dùng

Người mới được cung cấp các lựa chọn rõ ràng như:

- Cài đặt công cụ AI
- Đóng gói công việc với AI
- Hướng dẫn sử dụng AI

Nhưng người dùng có kinh nghiệm vẫn có thể bỏ qua các lựa chọn này và chat tự do.

---

## 5.3. Không yêu cầu setup kỹ thuật từ người dùng

Không nên xuất hiện các hướng dẫn kiểu:

- cài Node.js;
- chạy npm;
- thêm PATH;
- mở PowerShell;
- sửa biến môi trường;
- cài Git;
- cấu hình JSON.

Nếu những bước này cần thiết, EasyAI phải tự xử lý hoặc đưa vào package được quản lý.

---

## 5.4. Windows-first

EasyAI ưu tiên:

- Windows 10/11;
- máy doanh nghiệp;
- môi trường không có Administrator;
- deployment per-user;
- portable mode;
- proxy/network policy;
- phần cứng cấu hình thấp.

---

## 5.5. Runtime theo nhu cầu

Các thành phần nặng không được chạy liên tục.

Ví dụ:

- Pi Agent chỉ khởi tạo khi cần.
- Runtime Python/Node/Git chỉ được provision khi workflow cần.
- Background polling được hạn chế.
- Workflow không sử dụng thì không chiếm tài nguyên.

---

# 6. Tech Stack lựa chọn

## 6.1. TypeScript

**Vai trò:** Ngôn ngữ chính của EasyAI.

### Lý do lựa chọn

- Pi Agent được phát triển trong ecosystem TypeScript/Node.js.
- Có thể tích hợp Pi SDK trực tiếp.
- Phù hợp với Electron và React.
- Dùng chung type giữa UI, IPC, workflow và agent runtime.
- Ecosystem desktop/AI UI hiện tại hỗ trợ TypeScript rất tốt.
- Giảm số lượng ngôn ngữ chính cần duy trì.

---

## 6.2. Electron

**Vai trò:** Desktop application framework.

### Mục đích

- Build ứng dụng Windows desktop.
- Bundle Node.js runtime cùng ứng dụng.
- Người dùng không cần cài Node.js riêng.
- Có thể chạy Pi SDK trực tiếp.
- Hỗ trợ installer và portable application.
- Có ecosystem ổn định và mature.

### Định hướng sử dụng

EasyAI không sử dụng Electron như một ứng dụng web desktop nặng với nhiều window.

Ứng dụng ưu tiên:

- một BrowserWindow chính;
- các tác vụ nặng chạy ngoài renderer;
- lazy load agent;
- hạn chế background process;
- tối ưu cho máy cấu hình thấp.

---

## 6.3. electron-vite

**Vai trò:** Tooling cho quá trình phát triển và build Electron.

### Mục đích

- Quản lý main process, preload và renderer.
- Tăng tốc development.
- Giữ cấu hình build đơn giản.
- Tận dụng Vite cho frontend.

Đây là lớp tooling, không phải thành phần mà người dùng cuối cần biết tới.

---

## 6.4. React

**Vai trò:** Xây dựng giao diện EasyAI.

### Lý do lựa chọn

React được ưu tiên thay vì Preact vì EasyAI sẽ sử dụng nhiều thư viện AI UI có ecosystem React mạnh hơn.

React phù hợp cho:

- chat interface;
- streaming response;
- workflow card;
- dynamic tool UI;
- package UI;
- settings;
- status/progress components.

---

## 6.5. assistant-ui

**Vai trò:** Nền tảng UI cho chat.

### Mục đích

Không tự xây lại toàn bộ các vấn đề phổ biến của một AI chat application như:

- streaming message;
- message list;
- auto-scroll;
- thread;
- composer;
- loading state;
- tool-call state;
- attachment;
- message actions;
- accessibility;
- error state.

EasyAI sử dụng assistant-ui như **chat shell**, nhưng vẫn sở hữu logic agent và workflow của riêng mình.

---

## 6.6. shadcn/ui

**Vai trò:** UI primitives và các component chung.

### Mục đích

Dùng cho:

- Button
- Card
- Dialog
- Dropdown
- Popover
- Tabs
- Tooltip
- Progress
- Skeleton
- Form
- Command menu

Ưu điểm quan trọng là component có thể được đưa trực tiếp vào source và tùy biến sâu theo design EasyAI.

---

## 6.7. Pi Agent SDK

**Vai trò:** Agent runtime chính trong phiên bản đầu tiên.

### Mục đích

Pi được sử dụng như engine để:

- chat với AI;
- sử dụng tool;
- thực hiện workflow;
- tương tác với filesystem;
- cài đặt package;
- kiểm tra môi trường;
- hỗ trợ người dùng thực hiện công việc;
- chạy các agent profile khác nhau.

EasyAI không coi Pi CLI là sản phẩm chính.

Pi được tích hợp như một runtime bên trong EasyAI.

---

## 6.8. Electron Utility Process

**Vai trò:** Chạy Pi Agent và các tác vụ nặng tách khỏi giao diện.

### Mục đích

Tách:

- UI;
- Electron main process;
- agent runtime.

Điều này giúp:

- Pi crash không làm EasyAI crash;
- có thể restart agent độc lập;
- giải phóng RAM khi agent không dùng;
- giữ main process nhẹ;
- hạn chế ảnh hưởng tới UI.

---

## 6.9. electron-builder

**Vai trò:** Packaging và distribution.

### Các target chính

#### EasyAI Setup.exe

Bản cài đặt mặc định cho nhân viên.

Ưu tiên:

- per-user installation;
- không yêu cầu Administrator nếu có thể;
- shortcut;
- update được quản lý.

#### EasyAI Portable.exe

Dành cho môi trường:

- không cho phép cài đặt;
- chỉ cho phép executable được whitelist;
- cần chạy thử nhanh.

Mục tiêu trải nghiệm:

> Download → mở file → sử dụng.

#### MSI / MSIX

Có thể bổ sung cho deployment IT quy mô lớn:

- Intune;
- SCCM;
- GPO;
- MDM;
- enterprise software distribution.

---

## 6.10. SQLite

**Vai trò:** Lưu dữ liệu local.

Có thể sử dụng cho:

- conversation metadata;
- thread;
- workflow state;
- local package metadata;
- preference;
- cache;
- agent session metadata.

Không dùng SQLite để thay thế backend quản trị tập trung.

---

## 6.11. Windows Credential Manager

**Vai trò:** Lưu secret an toàn.

Dùng cho các dữ liệu như:

- token;
- credential;
- API key;
- authentication state.

Không lưu secret dạng plain text trong config file.

---

# 7. Kiến trúc khái niệm

Ở mức khái niệm, EasyAI gồm các lớp sau:

```text
EasyAI UI
     ↓
Chat / Workflow Experience
     ↓
EasyAI Agent Runtime Abstraction
     ↓
Pi Agent
     ↓
EasyAI Tools
     ↓
Windows / Enterprise Systems / AI Services
```

Ngoài ra:

```text
EasyAI Server
     ↓
Policy
Packages
Workflow Definitions
Agent Profiles
Tool Catalog
Configurations
```

EasyAI client nhận các cấu hình được phép từ hệ thống quản trị.

---

# 8. Agent Runtime Abstraction

EasyAI không nên phụ thuộc cứng vào Pi về lâu dài.

Trong phiên bản đầu:

```text
EasyAI
   ↓
Pi Runtime
```

Trong tương lai:

```text
EasyAI
   ↓
Agent Runtime
   ├─ Pi
   ├─ Claude Code
   ├─ Codex
   ├─ OpenCode
   └─ agent khác
```

Điều này phù hợp với định vị của EasyAI:

> Không tự xây lại AI harness, mà tạo một lớp sử dụng và quản trị các harness tốt nhất.

---

# 9. Các loại tương tác chính

EasyAI hỗ trợ hai loại tương tác nhưng sử dụng chung một chat engine.

## 9.1. Free Chat

Người dùng có thể nhập trực tiếp:

> Tôi muốn AI giúp tổng hợp báo cáo hàng tuần thì nên làm thế nào?

EasyAI sử dụng profile general assistant.

Không yêu cầu workflow được chọn trước.

---

## 9.2. Guided Workflow

Người dùng chọn một mục đích từ giao diện.

Ví dụ:

```text
Cài đặt công cụ AI
        ↓
AI cho lập trình
        ↓
Claude Code
```

EasyAI sau đó khởi tạo một session với:

- agent profile phù hợp;
- instruction riêng;
- tool phù hợp;
- policy phù hợp;
- context phù hợp.

Người dùng vẫn tương tác với agent thông qua chat.

---

# 10. Workflow System

Workflow là một trong những thành phần quan trọng nhất của EasyAI.

Workflow không chỉ là một prompt.

Một workflow có thể định nghĩa:

- mục tiêu;
- agent profile;
- instructions;
- tool được phép dùng;
- skill;
- context;
- UI component;
- confirmation requirement;
- completion criteria.

Ví dụ:

## Workflow: Cài đặt Claude Code

Có thể sử dụng:

- System Information Tool
- Network Check Tool
- Package Manager
- Installation Tool
- Verification Tool

Agent có nhiệm vụ:

1. kiểm tra môi trường;
2. kiểm tra policy;
3. kiểm tra network;
4. cài dependency cần thiết;
5. cài công cụ;
6. cấu hình;
7. verify;
8. báo kết quả.

Người dùng không cần hiểu các bước kỹ thuật phía sau.

---

# 11. Workflow Catalog ban đầu

Trang mở đầu có ba nhóm chính.

---

## 11.1. Cài đặt công cụ AI

Mục tiêu:

Giúp người dùng tìm, cài đặt và cấu hình AI tool.

Các nhánh có thể gồm:

### Lập trình

- Claude Code
- Codex
- Pi
- công cụ coding khác được doanh nghiệp phê duyệt

### Công việc văn phòng

- công cụ hỗ trợ tài liệu;
- công cụ tổng hợp;
- trợ lý nội bộ.

### Research

- AI search;
- deep research;
- internal knowledge tools.

Workflow có thể tự động:

- kiểm tra máy;
- kiểm tra dependency;
- tải package;
- verify hash/signature;
- cấu hình runtime;
- cấu hình proxy;
- test hoạt động.

---

## 11.2. Đóng gói công việc với AI

Mục tiêu:

Giúp nhân viên biến một công việc lặp lại thành một workflow hoặc agent package.

Agent có thể hỏi:

- Bạn đang làm công việc gì?
- Input thường là gì?
- Output mong muốn là gì?
- Công việc hiện gồm những bước nào?
- Phần nào cần con người kiểm tra?
- Công việc chạy bao lâu một lần?
- Dữ liệu được phép đưa vào AI đến mức nào?

Sau đó EasyAI có thể tạo:

- workflow proposal;
- prompt;
- skill;
- tool configuration;
- automation package;
- hướng dẫn sử dụng.

Mục tiêu dài hạn là cho phép các workflow tốt được admin duyệt và publish lại cho người khác sử dụng.

---

## 11.3. Hướng dẫn sử dụng AI

Mục tiêu:

Giúp người chưa quen AI học cách sử dụng hiệu quả.

Có thể gồm:

### Bắt đầu với AI

- AI làm được gì?
- AI không làm tốt điều gì?
- cách đặt câu hỏi.

### Prompt

- cách mô tả yêu cầu;
- đưa context;
- yêu cầu output;
- review kết quả.

### AI cho công việc

- viết tài liệu;
- phân tích;
- lập trình;
- research;
- xử lý dữ liệu.

### An toàn và bảo mật

- dữ liệu nào được phép đưa vào AI;
- dữ liệu nào không được phép;
- các policy nội bộ.

---

# 12. Giao diện chính

EasyAI sử dụng giao diện lấy cảm hứng từ các ứng dụng chat AI hiện đại như ChatGPT nhưng đơn giản hóa cho môi trường doanh nghiệp.

---

## 12.1. Màn hình mở đầu

Khi mở EasyAI, người dùng được đưa thẳng vào chat.

Phần giữa màn hình hiển thị:

```text
              Bạn muốn tôi hỗ trợ gì?

        ┌─────────────────────────┐
        │ Cài đặt công cụ AI      │
        │ Thiết lập AI cho máy    │
        └─────────────────────────┘

        ┌─────────────────────────┐
        │ Đóng gói công việc      │
        │ Biến công việc thành    │
        │ workflow AI             │
        └─────────────────────────┘

        ┌─────────────────────────┐
        │ Hướng dẫn sử dụng AI    │
        │ Học và sử dụng AI       │
        │ hiệu quả hơn            │
        └─────────────────────────┘


       Hỏi EasyAI bất cứ điều gì...
```

Ba lựa chọn này được xem là **Suggested Workflows**.

---

# 13. Chat Interface

Sau khi người dùng:

- nhập câu hỏi;
- hoặc chọn workflow;

giao diện chuyển sang chat thông thường.

Ví dụ:

```text
User:
Tôi muốn cài Claude Code.

EasyAI:
Tôi sẽ kiểm tra máy của bạn trước.

✓ Windows phù hợp
✓ Network khả dụng
○ Đang kiểm tra Git...

[ Chi tiết ]
```

Chat hỗ trợ:

- streaming;
- markdown;
- code;
- tool result;
- progress;
- confirmation;
- attachment;
- error state.

---

# 14. Tool UI

Một tool call không nhất thiết chỉ hiển thị text.

EasyAI có thể render UI phù hợp với từng loại tool.

Ví dụ cài đặt:

```text
Claude Code

████████████████░░ 80%

Đang hoàn tất cấu hình...

✓ Runtime
✓ Git
✓ Package
○ Verification
```

Ví dụ cần xác nhận:

```text
EasyAI cần cài Git Portable để tiếp tục.

Dung lượng: 65 MB
Nguồn: Package được doanh nghiệp phê duyệt

[ Cài đặt ]   [ Hủy ]
```

Ví dụ workflow proposal:

```text
Workflow đề xuất

Input
Excel doanh số

AI xử lý
→ đọc dữ liệu
→ tổng hợp
→ phát hiện bất thường
→ tạo báo cáo

Output
Weekly Sales Report

[ Dùng workflow ]
[ Chỉnh sửa ]
```

---

# 15. Điều hướng

EasyAI tránh thiết kế nhiều màn hình phức tạp.

Có thể sử dụng sidebar nhỏ tương tự các ứng dụng chat.

Các mục chính:

- New Chat
- Recent Chats
- Workflows
- AI Tools
- Settings

Admin Console có thể là sản phẩm riêng hoặc mode riêng.

Trang chat vẫn là trung tâm của trải nghiệm.

---

# 16. Luồng sử dụng — Chat tự do

## Bước 1

Người dùng mở EasyAI.

## Bước 2

EasyAI hiển thị:

> Bạn muốn tôi hỗ trợ gì?

## Bước 3

Người dùng bỏ qua Suggested Workflows và nhập:

> Tôi cần AI hỗ trợ làm slide báo cáo tuần.

## Bước 4

EasyAI sử dụng general assistant profile.

## Bước 5

Agent hỏi thêm context nếu cần.

## Bước 6

Người dùng tiếp tục trao đổi như một AI chat thông thường.

---

# 17. Luồng sử dụng — Cài đặt công cụ AI

Ví dụ user muốn cài Codex.

## Bước 1

Chọn:

**Cài đặt công cụ AI**

## Bước 2

EasyAI hiển thị các nhóm tool.

Người dùng chọn:

**AI cho lập trình**

## Bước 3

Hiển thị tool được doanh nghiệp duyệt.

Người dùng chọn:

**Codex**

## Bước 4

EasyAI khởi tạo Installer Agent.

## Bước 5

Agent tự kiểm tra:

- Windows version;
- architecture;
- quyền user;
- dependency;
- network;
- proxy;
- disk space.

## Bước 6

Nếu cần dependency:

EasyAI đề nghị user xác nhận.

## Bước 7

EasyAI tải và cấu hình dependency vào managed runtime.

## Bước 8

Cài Codex.

## Bước 9

Verify.

## Bước 10

EasyAI thông báo:

> Codex đã sẵn sàng.

Có thể cung cấp:

**[ Mở Codex ]**

hoặc:

**[ Hướng dẫn sử dụng ]**

---

# 18. Luồng sử dụng — Đóng gói công việc với AI

## Bước 1

Người dùng chọn:

**Đóng gói công việc với AI**

## Bước 2

EasyAI hỏi:

> Bạn muốn AI hỗ trợ công việc nào?

Ví dụ:

> Mỗi tuần tôi nhận một file Excel và phải làm báo cáo tổng hợp.

## Bước 3

Agent hỏi thêm:

- file đầu vào;
- format;
- bước xử lý;
- đầu ra;
- rule;
- điểm cần kiểm tra.

## Bước 4

EasyAI tạo workflow proposal.

## Bước 5

Người dùng review.

## Bước 6

EasyAI có thể chạy thử workflow.

## Bước 7

Sau khi hoàn thiện:

- lưu workflow cá nhân;
- hoặc gửi lên admin để review/publish.

---

# 19. Luồng sử dụng — Hướng dẫn AI

## Bước 1

Chọn:

**Hướng dẫn sử dụng AI**

## Bước 2

Chọn mục:

- Bắt đầu với AI
- Viết prompt
- AI cho Excel
- AI cho tài liệu
- AI cho lập trình
- AI cho research
- AI và bảo mật

## Bước 3

EasyAI chuyển sang Teaching Agent tương ứng.

## Bước 4

Người dùng học thông qua hội thoại.

AI có thể:

- giải thích;
- đưa ví dụ;
- giao bài thực hành;
- review prompt;
- đề xuất tool phù hợp.

---

# 20. Easy Install

Easy install là một yêu cầu cốt lõi của EasyAI, không phải chỉ là yêu cầu kỹ thuật.

Mục tiêu:

> Người dùng không cần trở thành developer để sử dụng developer-grade AI tools.

---

## 20.1. Setup.exe

Use case mặc định.

Trải nghiệm:

```text
Download
   ↓
Double click
   ↓
Install
   ↓
Login
   ↓
Use
```

Ưu tiên cài per-user.

---

## 20.2. Portable

Trong môi trường hạn chế:

```text
EasyAI-Portable.exe
```

Không cần installer.

Người dùng chỉ cần mở application.

---

# 21. Managed Runtime

EasyAI có thể quản lý các runtime riêng mà không phụ thuộc vào software global trên máy.

Ví dụ:

```text
EasyAI Managed Runtime

Git Portable
Node.js
Python
Bash
Tool packages
```

Những runtime này chỉ được cài khi workflow yêu cầu.

Không bắt tất cả người dùng phải cài toàn bộ development stack.

---

# 22. Package Manager

Admin có thể publish package.

Một package có thể mô tả:

- tên tool;
- version;
- dependency;
- source;
- hash;
- runtime;
- network requirement;
- policy;
- install rule.

Người dùng chỉ nhìn thấy:

```text
Claude Code

Approved

[ Install ]
```

EasyAI xử lý toàn bộ logic kỹ thuật phía sau.

---

# 23. Không thay đổi môi trường hệ thống nếu không cần

EasyAI nên ưu tiên environment isolation.

Tránh:

- sửa global PATH;
- cài package global;
- thay registry không cần thiết;
- conflict Node/Python version đang có.

Thay vào đó:

EasyAI tạo runtime environment riêng cho từng tool hoặc từng nhóm tool.

Ưu điểm:

- không cần admin;
- uninstall sạch;
- dễ rollback;
- giảm conflict;
- dễ kiểm soát security.

---

# 24. Enterprise Policy

Admin có thể kiểm soát:

- AI provider;
- model;
- tool;
- workflow;
- package;
- endpoint;
- network domain;
- permission;
- local filesystem access;
- command execution;
- data handling.

Agent không được mặc định có toàn quyền.

---

# 25. Tool Permission

Một workflow chỉ được cấp tool cần thiết.

Ví dụ Teaching Agent:

```text
Web search
Document reader
```

không cần:

```text
Install package
PowerShell
Filesystem write
```

Installer Agent có thể cần:

```text
System info
Package manager
Network
Install
Verify
```

Việc giới hạn tool giúp:

- tăng bảo mật;
- giảm lỗi;
- agent dễ kiểm soát hơn;
- phù hợp governance.

---

# 26. Security Principles

EasyAI ưu tiên:

- context isolation;
- secret storage qua OS;
- permission-based tools;
- signed/verified packages;
- central policy;
- audit log;
- controlled network;
- restricted command execution;
- không expose Node trực tiếp cho renderer;
- tách agent runtime khỏi UI.

---

# 27. Performance Principles

EasyAI cần chạy tốt trên máy doanh nghiệp cấu hình thấp.

Các nguyên tắc:

- chỉ một BrowserWindow chính;
- UI tối giản;
- không dùng blur/animation nặng;
- agent lazy load;
- agent có thể dispose khi idle;
- virtualize danh sách chat dài;
- code highlighting chỉ khi cần;
- hạn chế background timer;
- không preload tất cả runtime;
- tool/package scan theo nhu cầu;
- main process không chạy task nặng.

---

# 28. Low-resource / Eco Mode

EasyAI có thể cung cấp profile dành cho máy yếu.

Ví dụ:

### Normal

- animation cơ bản;
- agent giữ lâu hơn;
- preload một số dữ liệu.

### Low-resource

- tắt animation;
- không preload agent;
- agent idle timeout ngắn;
- giảm background refresh;
- aggressive chat virtualization;
- lazy render nội dung nặng.

Admin cũng có thể ép profile theo nhóm thiết bị.

---

# 29. UI Style

Định hướng thiết kế:

- light mode first;
- flat;
- clean;
- minimal;
- blue accent;
- không 3D;
- không background phức tạp;
- hạn chế animation;
- hierarchy rõ ràng;
- ngôn ngữ dễ hiểu.

EasyAI nên tạo cảm giác:

- gần gũi như ChatGPT;
- đơn giản như một ứng dụng chat;
- nhưng đáng tin cậy như một phần mềm doanh nghiệp.

---

# 30. Ngôn ngữ trong UI

EasyAI nên tránh các thuật ngữ kỹ thuật khi không cần thiết.

Ví dụ thay vì:

> Agent runtime dependency is missing.

Hiển thị:

> EasyAI cần cài thêm một thành phần để tiếp tục.

Thay vì:

> Configure environment variable.

Hiển thị:

> EasyAI đang cấu hình công cụ.

Thay vì:

> Invoke tool.

Hiển thị:

> Đang kiểm tra hệ thống.

Mục tiêu là che giấu complexity nhưng vẫn cho phép người dùng kỹ thuật xem chi tiết khi cần.

---

# 31. Nguyên tắc Prompt và Workflow

Prompt nội bộ không nên hiển thị như user message.

Khi người dùng chọn:

> Cài đặt Claude Code

UI chỉ cần hiển thị hành động của người dùng.

Phần phía sau EasyAI tự khởi tạo:

- instruction;
- agent profile;
- tool;
- context;
- policy.

Điều này giúp:

- prompt có thể được cập nhật tập trung;
- người dùng không bị nhiễu;
- tránh lộ implementation detail;
- workflow thống nhất giữa các nhân viên.

---

# 32. Admin-published Workflow

Một mục tiêu dài hạn quan trọng:

Admin có thể publish workflow mà không cần phát hành version EasyAI mới.

Ví dụ:

```text
Workflow Catalog

IT
├─ Cài Claude Code
├─ Cài Codex
└─ Kiểm tra môi trường AI

Office
├─ Tạo báo cáo tuần
├─ Tóm tắt tài liệu
└─ Soạn email

Data
├─ Phân tích Excel
└─ Tạo báo cáo KPI
```

Client tải metadata và hiển thị workflow tương ứng.

---

# 33. EasyAI Tool Catalog

Ngoài Workflow Catalog, EasyAI có thể có AI Tool Catalog.

Mỗi tool hiển thị:

- tên;
- mô tả;
- approved status;
- category;
- version;
- install state.

Ví dụ:

```text
Claude Code

AI coding agent

✓ Approved by Company

[ Install ]
```

Sau khi cài:

```text
✓ Installed

[ Open ]
[ Update ]
```

---

# 34. Tầm nhìn dài hạn

EasyAI có thể phát triển từ một desktop AI assistant thành nền tảng AI enablement doanh nghiệp.

Các bước phát triển tự nhiên:

### Phase 1

- Chat.
- Pi Agent.
- Suggested workflow.
- AI tool installer.

### Phase 2

- Workflow package.
- Managed runtime.
- Tool catalog.
- Central policy.

### Phase 3

- Admin Console.
- Workflow publishing.
- Enterprise package registry.
- Audit.

### Phase 4

- Multi-agent runtime.
- Claude Code.
- Codex.
- OpenCode.
- Agent khác.

### Phase 5

- Organization workflow marketplace.
- Reusable agent package.
- Internal AI knowledge ecosystem.

---

# 35. Trải nghiệm mục tiêu

Trải nghiệm EasyAI cuối cùng nên đơn giản như:

```text
Mở EasyAI
   ↓
Bạn muốn tôi hỗ trợ gì?
   ↓
Chọn một nhu cầu
hoặc
Nhập câu hỏi
   ↓
EasyAI tự cấu hình agent phù hợp
   ↓
AI thực hiện công việc
   ↓
Người dùng chỉ xác nhận khi thực sự cần
```

Đây là điểm khác biệt quan trọng so với việc đưa cho nhân viên một AI chat trống hoặc một terminal AI tool.

---

# 36. Tóm tắt quyết định công nghệ

| Thành phần | Công nghệ | Mục đích |
|---|---|---|
| Ngôn ngữ | TypeScript | Ngôn ngữ chính toàn ứng dụng |
| Desktop | Electron | Windows desktop runtime |
| Build | electron-vite | Development/build Electron |
| UI | React | Giao diện |
| Chat | assistant-ui | Chat primitives và streaming UX |
| UI Components | shadcn/ui | Component cơ bản |
| Agent v1 | Pi Agent SDK | AI agent runtime |
| Agent Process | Electron Utility Process | Tách agent khỏi UI |
| Local Data | SQLite | Local state và metadata |
| Secrets | Windows Credential Manager | Lưu credential |
| Packaging | electron-builder | Setup, portable, enterprise package |
| Runtime | EasyAI Managed Runtime | Git/Node/Python/tool theo nhu cầu |
| Governance | EasyAI Server | Policy, workflow, package, config |

---

# 37. Kết luận

EasyAI nên được phát triển như một **AI desktop platform đơn giản ở phía người dùng nhưng có khả năng quản trị mạnh ở phía sau**.

Ba điểm cốt lõi của sản phẩm là:

### 1. Chat dễ sử dụng

Người dùng vẫn có trải nghiệm quen thuộc như ChatGPT.

### 2. Guided Workflow

Người dùng không cần biết prompt engineering. EasyAI giúp họ bắt đầu từ nhu cầu cụ thể.

### 3. Easy Deployment

Các công cụ AI phức tạp được EasyAI cài đặt, cấu hình và quản lý thay cho người dùng.

Nhờ đó, EasyAI không chỉ giúp nhân viên **có AI**, mà giúp doanh nghiệp thực sự **phổ cập AI** theo cách kiểm soát được, an toàn và có thể mở rộng.
