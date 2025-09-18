# Conversation Module

## Tong quan

Module nay quan ly cuoc tro chuyen theo lop hoc, gom hai loai:

- class: nhom chung cua giao vien va tat ca hoc sinh trong lop.
- personal: tro chuyen rieng giua giao vien va tung hoc sinh (hoac nguoi dung duoc phan lop).

Moi cuoc tro chuyen buoc phai gan voi classroomId.

## Du lieu chinh

- **Conversation**: thong tin cuoc tro chuyen (classroom, type, scopeKey, metadata, last message...)
- **ConversationParticipant**: thanh vien + trang thai (mute/pin/lastReadAt)
- **Message**: noi dung gui trong cuoc tro chuyen, ho tro metadata va attachments JSON.

## Luong lam viec (REST)

Tat ca API o duong dan /private/v1/classrooms/:classroomId/conversations va yeu cau Bearer token.

| Method  | Path                      | Mo ta                                                                  |
| ------- | ------------------------- | ---------------------------------------------------------------------- |
| GET     | /                         | Liet ke cac cuoc tro chuyen theo lop (ho tro filter ype, page, limit). |
| POST    | /                         | Tao moi hoac tra ve cuoc tro chuyen (class/personal).                  |
| GET     | /:conversationId          | Lay chi tiet cuoc tro chuyen (participants, metadata, unreadCount).    |
| GET     | /:conversationId/messages | Liet ke tin nhan (page, limit, sortOrder=asc\|desc, before, after).    |
| POST    | /:conversationId/messages | Gui tin nhan moi.                                                      |
| POST    | /:conversationId/read     | Danh dau da doc (co the truyen                                         |
| eadAt). |

### Tham so quan trong

- **Create conversation (personal)**:
  `json
{
  "type": "personal",
  "participantIds": ["<targetUserId>"],
  "name": "Tu van rieng"
}
`
- **Create conversation (class)**:
  `json
{
  "type": "class",
  "name": "Thong bao toan lop"
}
`
- **Send message**:
  `json
{
  "content": "Xin chao ca lop!",
  "type": "text",
  "metadata": { "attachments": [] }
}
`

## Socket events

Su dung Socket.IO (gateway EventsGateway).

- **conversation.message**: day ra moi tin nhan. Payload:
  `json
{
  "conversation": { ...ConversationSummaryDto },
  "message": { ...ConversationMessageDto }
}
`
- **conversation.updated**: thong bao conversation vua cap nhat (last message, unreadCount...). Payload la ConversationSummaryDto.

Client nen tham gia phong user:{userId} (gateway tu dong join khi ket noi co query userId).

## Buoc cai dat

1. Cap nhat schema Prisma (libs/database/prisma/schema.prisma).
2. Chay
   pm run prisma:generate va
   pm run prisma:migrate de tao migration moi.
3. Build lai API:
   pm run build.

## Luu y

- scopeKey la duy nhat, dung de dam bao personal conversation khong bi tao trung.
- Service tu dong dong bo thanh vien class conversation (giao vien + hoc sinh dang active).
- Tat ca thong tin metadata/attachments la JSON goc, client co the tuy chinh theo nhu cau.
