# Agent Module - Status & Missing Implementation

> Cập nhật: 2025-01-XX

## ✅ Đã Implement

### Services
- ✅ `StudentAgentService` - Service riêng cho Student
- ✅ `ParentAgentService` - Service riêng cho Parent
- ✅ `LangChainAgentService` - Service chung cho Teacher/Admin/Other
- ✅ `LandingConsultantService` - Service cho landing page
- ✅ `RagService`, `SqlService`, `GraphEntityService`, etc.

### Tools
- ✅ `StudentAgentTools` - 16 tools chuyên biệt cho Student
- ✅ `ParentAgentTools` - 7 tools chuyên biệt cho Parent
- ✅ Core tools: `RagTool`, `SqlTool`, `ChartGeneratorTool`, `ExcelExportTool`, `PdfExportTool`, `WordExportTool`, `ReportAdvisorTool`, `GraphQueryTool`

### Endpoints
**Public:**
- ✅ `POST /public/v1/ai/query` - General AI query
- ✅ `POST /public/v1/ai/consultant/query` - Landing consultant query
- ✅ `GET /public/v1/ai/consultant/stream` - Landing consultant stream

**Private:**
- ✅ `POST /private/v1/agent/chat` - General chat
- ✅ `GET /private/v1/agent/chat/stream` - General stream
- ✅ `GET /private/v1/agent/student/chat/stream` - Student stream
- ✅ `GET /private/v1/agent/parent/chat/stream` - Parent stream
- ✅ `GET /private/v1/agent/recommendations` - Recommendations
- ✅ `GET /private/v1/agent/conversations` - List conversations
- ✅ `GET /private/v1/agent/conversations/:id` - Get conversation
- ✅ `POST /private/v1/agent/conversations/:id/delete` - Delete conversation
- ✅ Knowledge base management endpoints
- ✅ Learning analytics endpoints

### Features
- ✅ Conversation history
- ✅ Streaming support (SSE)
- ✅ Role-based routing
- ✅ Context-aware responses
- ✅ Knowledge base (RAG)
- ✅ SQL query tool
- ✅ Graph database integration
- ✅ Export tools (Excel, PDF, Word)
- ✅ Chart generation
- ✅ Report advisor

---

## ❌ Chưa Implement

### 1. Teacher Role - Chưa có Service/Tools riêng

**Hiện tại:**
- Teacher dùng `LangChainAgentService` với prompt chung
- Có context loading trong `agent.service.ts` (line 86-87)
- Không có tools chuyên biệt cho Teacher

**Cần implement:**
- ❌ `TeacherAgentService` - Service riêng cho Teacher
- ❌ `TeacherAgentTools` - Tools chuyên biệt cho Teacher
- ❌ `GET /private/v1/agent/teacher/chat/stream` - Endpoint riêng

**Tools Teacher cần:**
- `get_my_classrooms` - Lấy danh sách lớp đang dạy
- `get_classroom_students` - Lấy danh sách học sinh trong lớp
- `get_student_progress` - Xem tiến độ học tập của học sinh
- `get_student_scores` - Xem điểm số của học sinh
- `get_classroom_statistics` - Thống kê lớp học
- `create_announcement` - Tạo thông báo cho lớp
- `export_classroom_data` - Xuất dữ liệu lớp học
- `get_assignment_submissions` - Xem bài nộp của học sinh
- `grade_assignment` - Chấm điểm bài tập (nếu có quyền)

### 2. Admin Role - Chưa có Service/Tools riêng

**Hiện tại:**
- Admin dùng `LangChainAgentService` với prompt "full access"
- Không có tools chuyên biệt cho Admin

**Cần implement (Optional):**
- ❌ `AdminAgentService` - Service riêng cho Admin (optional)
- ❌ `AdminAgentTools` - Tools chuyên biệt cho Admin (optional)
- ❌ `GET /private/v1/agent/admin/chat/stream` - Endpoint riêng (optional)

**Lý do optional:**
- Admin có thể dùng `LangChainAgentService` với full access
- Có thể không cần service riêng nếu tools chung đủ mạnh

**Tools Admin có thể cần:**
- `get_system_statistics` - Thống kê toàn hệ thống
- `get_user_management` - Quản lý người dùng
- `get_course_management` - Quản lý khóa học
- `get_classroom_management` - Quản lý lớp học
- `export_system_report` - Xuất báo cáo hệ thống
- `get_analytics_dashboard` - Dashboard analytics

### 3. API Tools - Chưa được sử dụng

**Files tồn tại nhưng chưa được register:**
- ❌ `api.tool.ts` - Tool để gọi API endpoints
- ❌ `api-search.tool.ts` - Tool để search API endpoints

**Cần:**
- Register trong `agent.module.ts`
- Thêm vào tools list của `LangChainAgentService` (hoặc các service khác)
- Có thể hữu ích cho Admin/Teacher để gọi các API khác

### 4. Role-based Tool Filtering - Chưa implement đầy đủ

**Hiện tại:**
- `LangChainAgentService` có tất cả tools cho mọi role
- Không có filtering dựa trên role

**Cần:**
- ❌ Filter tools dựa trên user role
- ❌ Teacher chỉ thấy tools của Teacher
- ❌ Admin thấy tất cả tools
- ❌ Student/Parent đã có service riêng nên OK

### 5. Error Handling & Retry Logic

**Cần cải thiện:**
- ❌ Retry logic khi tool call fails
- ❌ Better error messages cho từng role
- ❌ Rate limiting per user/role
- ❌ Timeout handling

### 6. Analytics & Monitoring

**Cần thêm:**
- ❌ Usage analytics per role
- ❌ Tool usage statistics
- ❌ Response time tracking
- ❌ Error rate monitoring
- ❌ User satisfaction metrics

### 7. Advanced Features

**Có thể thêm:**
- ❌ Multi-turn conversation context
- ❌ Voice input/output support
- ❌ File upload support (cho Teacher/Admin)
- ❌ Scheduled reports
- ❌ Custom prompts per user
- ❌ Conversation templates

---

## 📊 Tổng Kết

### Đã hoàn thành: ~80%
- ✅ Student: 100% (service + tools + endpoint)
- ✅ Parent: 100% (service + tools + endpoint)
- ✅ Landing Consultant: 100%
- ✅ Core features: 100%
- ⚠️ Teacher: ~30% (chỉ có context, chưa có service/tools riêng)
- ⚠️ Admin: ~30% (chỉ có prompt, chưa có service/tools riêng)

### Ưu tiên implement:

1. **HIGH**: TeacherAgentService + TeacherAgentTools + endpoint
   - Teacher là role quan trọng, cần tools chuyên biệt
   - Cần quản lý lớp học, học sinh, điểm số

2. **MEDIUM**: Role-based tool filtering
   - Bảo mật và UX tốt hơn
   - Teacher không cần thấy tools của Admin

3. **LOW**: AdminAgentService (optional)
   - Admin có thể dùng LangChainAgentService
   - Chỉ cần nếu muốn có tools rất chuyên biệt

4. **LOW**: API tools integration
   - Có thể hữu ích nhưng không critical

---

## 🔧 Quick Implementation Guide

### Teacher Agent (Priority 1)

1. Tạo `TeacherAgentTools`:
   ```typescript
   // tools/teacher-agent.tools.ts
   - get_my_classrooms
   - get_classroom_students
   - get_student_progress
   - get_student_scores
   - get_classroom_statistics
   - create_announcement
   - export_classroom_data
   ```

2. Tạo `TeacherAgentService`:
   ```typescript
   // service/teacher-agent.service.ts
   - Similar to StudentAgentService/ParentAgentService
   - Use TeacherAgentTools
   - Teacher-specific prompt
   ```

3. Thêm endpoint:
   ```typescript
   // controller/private-agent.controller.ts
   @Get('teacher/chat/stream')
   async streamTeacherChat(...)
   ```

4. Update routing:
   ```typescript
   // service/agent.service.ts
   if (userRole === 'teacher') {
     // Route to TeacherAgentService
   }
   ```

---

## 📝 Notes

- Student và Parent đã có đầy đủ service + tools + endpoints
- Teacher và Admin hiện dùng LangChainAgentService chung
- Có thể không cần AdminAgentService nếu tools chung đủ mạnh
- API tools có thể hữu ích nhưng không critical

