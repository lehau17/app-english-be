# Tính năng Lưu Lịch Sử Chat với AI Agent

## Tổng Quan

Tính năng này cho phép AI agent lưu trữ và sử dụng lịch sử hội thoại với người dùng, giúp cung cấp câu trả lời có ngữ cảnh bằng cách truyền các tin nhắn trước đó vào hệ thống RAG (Retrieval-Augmented Generation).

## Vấn Đề Đã Được Giải Quyết

**Vấn đề ban đầu:** Trong RAG hiện tại chưa lưu đoạn chat của AI với admin, và luôn truyền mảng rỗng vào RAG thay vì tin nhắn cũ.

**Giải pháp:** 
- ✅ Lưu trữ toàn bộ lịch sử hội thoại trong database
- ✅ Tự động load 10 tin nhắn gần nhất làm context
- ✅ Truyền lịch sử vào RAG để có câu trả lời có ngữ cảnh
- ✅ Quản lý conversations: xem danh sách, chi tiết, xóa

## Cấu Trúc Database

### Bảng AgentConversation
Lưu trữ các cuộc hội thoại giữa người dùng và AI.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| id | UUID | Khóa chính |
| userId | UUID | ID người dùng |
| title | String | Tiêu đề (tự động từ tin nhắn đầu tiên) |
| metadata | JSON | Dữ liệu bổ sung |
| createdAt | DateTime | Thời gian tạo |
| updatedAt | DateTime | Thời gian cập nhật |

### Bảng AgentMessage
Lưu trữ từng tin nhắn trong cuộc hội thoại.

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| id | UUID | Khóa chính |
| conversationId | UUID | ID cuộc hội thoại |
| role | String | 'user' hoặc 'assistant' |
| content | Text | Nội dung tin nhắn |
| metadata | JSON | Thông tin bổ sung (công cụ đã dùng, lý luận, v.v.) |
| createdAt | DateTime | Thời gian tạo |

## API Endpoints

### POST /agent/chat
Gửi tin nhắn cho AI agent.

**Request:**
```json
{
  "message": "Có những khóa học nào?",
  "conversationId": "uuid-tùy-chọn-để-tiếp-tục-hội-thoại"
}
```

**Response:**
```json
{
  "response": "Dưới đây là các khóa học...",
  "conversationId": "uuid-của-cuộc-hội-thoại",
  "confidence": 0.85,
  "sources": ["Knowledge Base", "Database"],
  "toolsUsed": ["knowledge_search", "call_api"],
  "processingTime": 1234
}
```

### GET /agent/conversations
Xem danh sách hội thoại của người dùng.

**Query Parameters:**
- `limit` (tùy chọn, mặc định: 20): Số lượng hội thoại
- `offset` (tùy chọn, mặc định: 0): Bỏ qua số hội thoại

### GET /agent/conversations/:id
Xem chi tiết một hội thoại với tất cả tin nhắn.

### POST /agent/conversations/:id/delete
Xóa một hội thoại và tất cả tin nhắn.

## Cách Hoạt Động

### Luồng Xử Lý Chat với Context

1. **Người dùng gửi tin nhắn:**
   ```json
   {
     "message": "Khóa học tiếng Anh cơ bản giá bao nhiêu?",
     "conversationId": "uuid-nếu-có"
   }
   ```

2. **Hệ thống load context:**
   - Nếu có `conversationId`, load 10 tin nhắn gần nhất
   - Nếu không có, tạo conversation mới
   - Lưu tin nhắn của user vào database

3. **Format lịch sử cho LangChain:**
   ```typescript
   [
     ['human', 'Khóa học tiếng Anh cơ bản giá bao nhiêu?'],
     ['assistant', 'Khóa học cơ bản có giá 500.000đ'],
     ['human', 'Khóa đó học trong bao lâu?']  // tin nhắn hiện tại
   ]
   ```

4. **Truyền vào RAG:**
   - LangChain agent nhận lịch sử chat
   - Sử dụng context để hiểu câu hỏi
   - Ví dụ: "Khóa đó" → hiểu là "Khóa học tiếng Anh cơ bản"

5. **Lưu response:**
   - Lưu câu trả lời của AI vào database
   - Kèm metadata: công cụ đã dùng, lý luận, thời gian xử lý

6. **Trả về kết quả:**
   ```json
   {
     "response": "Khóa học cơ bản kéo dài 3 tháng...",
     "conversationId": "uuid",
     ...
   }
   ```

## Ví Dụ Sử Dụng

### Tạo hội thoại mới:
```bash
curl -X POST http://localhost:3334/agent/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Cho tôi biết về các khóa học dành cho người mới bắt đầu"
  }'
```

Lưu `conversationId` từ response để dùng cho tin nhắn tiếp theo.

### Tiếp tục hội thoại (có context):
```bash
curl -X POST http://localhost:3334/agent/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Bạn khuyên tôi nên chọn khóa nào?",
    "conversationId": "<id-từ-bước-trước>"
  }'
```

AI sẽ hiểu "khóa nào" dựa trên context của tin nhắn trước.

### Xem danh sách hội thoại:
```bash
curl -X GET "http://localhost:3334/agent/conversations?limit=10" \
  -H "Authorization: Bearer <token>"
```

### Xem chi tiết hội thoại:
```bash
curl -X GET "http://localhost:3334/agent/conversations/:id?id=<conversation-id>" \
  -H "Authorization: Bearer <token>"
```

## Cài Đặt

### 1. Chạy Migration

```bash
# Generate Prisma client
npm run prisma:generate

# Chạy migration để tạo bảng mới
npm run prisma:migrate
```

Migration sẽ tạo 2 bảng: `AgentConversation` và `AgentMessage`.

### 2. Khởi động Server

```bash
npm run start:client-api:dev
```

### 3. Test API

Sử dụng file `docs/AGENT_CHAT_TESTING.md` để test thủ công.

## Kiểm Tra Context Đang Hoạt Động

Để kiểm tra lịch sử chat có được truyền vào RAG không:

**Tin nhắn 1:**
```
"Giá khóa học Advanced Grammar là bao nhiêu?"
```

**Tin nhắn 2:** (với cùng conversationId)
```
"Khóa đó có bao nhiêu bài học?"
```

**Kết quả mong đợi:**
- AI hiểu "khóa đó" là "Advanced Grammar"
- Trả lời chính xác về số bài học của khóa Advanced Grammar

**Tin nhắn 3:**
```
"Nó phù hợp với người trung cấp không?"
```

**Kết quả mong đợi:**
- AI hiểu "nó" vẫn là "khóa Advanced Grammar"
- Đánh giá độ phù hợp dựa trên thông tin đã có

## Kiến Trúc Code

```
PrivateAgentController (controller/)
    ↓ nhận request từ user
    ↓
AgentService (service/)
    ↓ quản lý logic
    ↓
    ├─→ AgentChatRepository (repository/)
    │       ↓ lưu/load conversation và messages
    │       ↓
    │   Database (AgentConversation, AgentMessage)
    │
    └─→ LangChainAgentService (service/)
            ↓ xử lý AI với context
            ↓
        RAG Tools (knowledge_search, call_api, database_query)
```

## Bảo Mật

- ✅ Tất cả endpoints yêu cầu JWT authentication
- ✅ User chỉ có thể truy cập conversation của chính họ
- ✅ Thử truy cập conversation của người khác → lỗi "access denied"

## Files Đã Thay Đổi

### Schema & Migration
- `libs/database/prisma/schema.prisma` - Thêm models AgentConversation, AgentMessage
- `prisma/migrations/20251003191957_add_agent_chat_tables/` - SQL migration

### Repository
- `apps/client-api/src/domains/agent/repository/agent-chat.repository.ts` - CRUD cho conversation và message

### DTOs
- `apps/client-api/src/domains/agent/dto/agent.dto.ts` - Thêm conversationId vào request/response

### Service
- `apps/client-api/src/domains/agent/service/agent.service.ts` - Logic lưu/load history
- `apps/client-api/src/domains/agent/service/langchain-agent.service.ts` - Nhận và format history

### Controller
- `apps/client-api/src/domains/agent/controller/private-agent.controller.ts` - Endpoints mới

### Module
- `apps/client-api/src/domains/agent/agent.module.ts` - Register repository

### Documentation
- `docs/AGENT_CHAT_HISTORY.md` - Tài liệu tiếng Anh
- `docs/AGENT_CHAT_TESTING.md` - Hướng dẫn test
- `docs/AGENT_CHAT_HISTORY_VI.md` - Tài liệu tiếng Việt (file này)

## Tính Năng Trong Tương Lai

- [ ] Tìm kiếm trong conversation
- [ ] Chia sẻ conversation giữa users
- [ ] Export conversation (PDF/JSON)
- [ ] Tóm tắt conversation dài
- [ ] Thêm tags/categories cho conversation
- [ ] Archive conversation

## Troubleshooting

### "Conversation not found"
- **Nguyên nhân:** ConversationId không tồn tại hoặc thuộc user khác
- **Giải pháp:** Kiểm tra conversationId và đảm bảo nó thuộc về user đang đăng nhập

### AI không nhớ context
- **Nguyên nhân:** Không truyền conversationId trong request tiếp theo
- **Giải pháp:** Đảm bảo include conversationId trong mọi tin nhắn tiếp theo

### Database error
- **Nguyên nhân:** Chưa chạy migration
- **Giải pháp:** Chạy `npm run prisma:migrate`

## Liên Hệ

Nếu có vấn đề hoặc câu hỏi, vui lòng tạo issue trên GitHub.
