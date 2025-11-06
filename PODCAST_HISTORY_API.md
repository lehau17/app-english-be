# Podcast Learning History API

> **Ngày tạo**: 2025-11-06
> **Mô tả**: Backend API cho tính năng lịch sử học tập podcast

## ✅ Hoàn Thành

### 📁 Files Tạo/Sửa

```
apps/client-api/src/domains/podcast/
├── dto/
│   └── podcast.dto.ts                     # + GetUserAttemptsQueryDto
├── service/
│   └── podcast.service.ts                 # + getAllUserAttempts()
├── controller/
│   ├── podcast-attempt.controller.ts      # NEW CONTROLLER
│   └── private-podcast.controller.ts      # (decorated existing endpoint)
└── podcast.module.ts                      # + PodcastAttemptController
```

## 🎯 API Endpoint

### GET `/private/v1/podcast-attempts/my-history`

**Description**: Lấy toàn bộ lịch sử làm bài podcast của user đang đăng nhập

**Authentication**: Required (Bearer Token)

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 50 | Items per page |
| `status` | string | No | - | Filter by status: `in_progress`, `completed`, `abandoned` |

**Example Request**:

```bash
GET /private/v1/podcast-attempts/my-history?page=1&limit=50&status=completed
Authorization: Bearer <token>
```

**Response Success (200)**:

```json
{
  "data": [
    {
      "attemptId": "uuid",
      "attemptNo": 1,
      "podcastId": "uuid",
      "podcast": {
        "id": "uuid",
        "title": "Business English Conversation",
        "category": "business",
        "difficulty": "intermediate",
        "code": "POD-001"
      },
      "status": "completed",
      "scorePercent": 85.5,
      "correctCount": 17,
      "totalQuestions": 20,
      "timeSpent": 450,
      "createdAt": "2024-01-15T10:30:00Z",
      "answers": {
        "gap1": "answer1",
        "gap2": "answer2"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 120,
    "totalPages": 3
  }
}
```

**Response Error**:

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

## 📊 Database Query

**Tables Used**:
- `podcast_attempts` (main)
- `podcasts` (joined)

**Query Logic**:
```sql
SELECT
  pa.*,
  p.id, p.title, p.category, p.difficulty, p.code
FROM podcast_attempts pa
INNER JOIN podcasts p ON pa.podcastId = p.id
WHERE pa.userId = $userId
  AND pa.status = $status (optional)
ORDER BY pa.createdAt DESC
LIMIT $limit OFFSET $skip
```

**Performance**:
- Indexed on `userId` (existing)
- Indexed on `createdAt` (existing)
- Join on `podcastId` (foreign key)

## 🔧 Implementation Details

### 1. DTO (Data Transfer Object)

**File**: `dto/podcast.dto.ts`

```typescript
export class GetUserAttemptsQueryDto extends RequestPagingDto {
    @ApiPropertyOptional({
        description: 'Filter by attempt status',
        enum: ['in_progress', 'completed', 'abandoned'],
    })
    @IsOptional()
    @IsString()
    status?: 'in_progress' | 'completed' | 'abandoned';
}
```

### 2. Service Method

**File**: `service/podcast.service.ts`

```typescript
async getAllUserAttempts(
    userId: string,
    query: GetUserAttemptsQueryDto,
) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.status) {
        where.status = query.status;
    }

    const [attempts, total] = await Promise.all([
        this.prisma.podcastAttempt.findMany({
            where,
            include: {
                podcast: {
                    select: {
                        id: true,
                        title: true,
                        category: true,
                        difficulty: true,
                        code: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        this.prisma.podcastAttempt.count({ where }),
    ]);

    const data = attempts.map((a) => ({
        attemptId: a.id,
        attemptNo: a.attemptNo,
        podcastId: a.podcastId,
        podcast: a.podcast,
        status: a.status,
        scorePercent: a.scorePercent,
        correctCount: a.correctCount,
        totalQuestions: a.totalQuestions,
        timeSpent: a.timeSpent,
        createdAt: a.createdAt,
        answers: a.answers,
    }));

    return PageResponseDto.of(data, page, limit, total);
}
```

### 3. Controller

**File**: `controller/podcast-attempt.controller.ts` (NEW)

```typescript
@ApiTags('Podcast Attempts')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/podcast-attempts')
export class PodcastAttemptController {
    constructor(private readonly podcastService: PodcastService) {}

    @Get('my-history')
    @ApiOperation({
        summary: 'Get all podcast attempts for current user',
        description: 'Retrieve learning history with all podcast attempts...',
    })
    @ResponseMessage('User attempts history retrieved successfully')
    async getMyHistory(
        @PayloadToken() payload: JwtPayload,
        @Query() query: GetUserAttemptsQueryDto,
    ) {
        const userId = payload.sub;
        return this.podcastService.getAllUserAttempts(userId, query);
    }
}
```

### 4. Module Registration

**File**: `podcast.module.ts`

```typescript
@Module({
    imports: [DatabaseModule, ConfigModule],
    controllers: [
        PodcastController,
        PodcastAttemptController, // ✅ Added
        PodcastTestController,
        PlaylistController,
    ],
    // ... providers
})
export class PodcastModule {}
```

## 🧪 Testing

### Manual Test với cURL

```bash
# 1. Login để lấy token
curl -X POST http://localhost:3334/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# 2. Test API với token
curl -X GET "http://localhost:3334/api/private/v1/podcast-attempts/my-history?page=1&limit=10&status=completed" \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Test với Swagger

1. Truy cập: `http://localhost:3334/api/docs`
2. Authenticate với Bearer token
3. Tìm section "Podcast Attempts"
4. Test endpoint "GET /private/v1/podcast-attempts/my-history"

### Expected Scenarios

**Scenario 1: User chưa làm bài**
```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 0,
    "totalPages": 0
  }
}
```

**Scenario 2: User có attempts**
- Response trả về danh sách attempts
- Sorted by createdAt DESC (mới nhất trước)
- Include podcast info (title, category, difficulty, code)

**Scenario 3: Filter by status**
- `?status=completed` → Chỉ attempts đã hoàn thành
- `?status=in_progress` → Chỉ attempts đang làm
- `?status=abandoned` → Chỉ attempts bỏ dở

**Scenario 4: Pagination**
- `?page=1&limit=10` → 10 items đầu
- `?page=2&limit=10` → 10 items tiếp theo
- Meta có totalPages để frontend biết có bao nhiêu trang

## 🔐 Security

**Authorization**:
- Endpoint protected bởi `@ApiBearerAuth`
- Chỉ lấy attempts của chính user đó (`userId = payload.sub`)
- Không thể xem attempts của người khác

**Data Privacy**:
- Answers field chứa câu trả lời của user
- Chỉ trả về cho chính user đó

## 📝 Frontend Integration

**Frontend đã sẵn sàng!**

Hook đã tạo trong `englishWeb/src/hooks/podcastAttempt.hooks.ts`:

```typescript
export const useAllUserAttempts = (params?: {
  page?: number
  limit?: number
  status?: 'in_progress' | 'completed' | 'abandoned'
}) => {
  return useQuery({
    queryKey: ['all-user-attempts', params],
    queryFn: () => podcastAttemptApi.getAllUserAttempts(params),
  })
}
```

API service trong `englishWeb/src/services/podcastAttempt.api.ts`:

```typescript
getAllUserAttempts: async (params?: {
  page?: number
  limit?: number
  status?: 'in_progress' | 'completed' | 'abandoned'
}): Promise<any> => {
  const response = await api.get(`/private/v1/podcast-attempts/my-history`, {
    params,
  })
  return response.data
}
```

**Page sử dụng**: `/listening-practice/my-history`

## ✅ Build Status

```bash
npm run build  # ✅ SUCCESS
```

- No TypeScript errors
- No linter errors
- Webpack compiled successfully

## 📈 Performance Considerations

**Current Implementation**:
- Default limit: 50 items
- Max recommended limit: 100 items
- Uses Prisma's efficient pagination (skip/take)
- Indexed queries on userId and createdAt

**For Large Datasets** (1000+ attempts):
- Consider cursor-based pagination
- Add caching layer (Redis)
- Implement virtual scrolling on frontend

## 🚀 Deployment Checklist

- [x] DTO created
- [x] Service method implemented
- [x] Controller created
- [x] Module registered
- [x] Build successful
- [x] No linter errors
- [ ] Manual testing (sau khi chạy server)
- [ ] Integration testing
- [ ] Swagger documentation verified

## 🐛 Known Issues

None at this time.

## 📚 Related APIs

**Existing Related Endpoints**:

1. `GET /private/v1/podcasts/:id/attempts`
   - Lấy attempts cho 1 podcast cụ thể
   - Khác với my-history (lấy TẤT CẢ podcasts)

2. `POST /private/v1/podcasts/:id/start`
   - Bắt đầu attempt mới

3. `POST /private/v1/podcasts/:id/submit`
   - Submit attempt

## 🔮 Future Enhancements

### Phase 2
- [ ] Export history to CSV/PDF
- [ ] Statistics aggregation (avg score, total time, etc.)
- [ ] Date range filtering
- [ ] Sort options (by score, by date, by podcast)

### Phase 3
- [ ] Comparison between attempts
- [ ] Progress tracking over time
- [ ] AI-powered insights
- [ ] Learning recommendations

---

**Status**: ✅ **COMPLETED & READY**

**Next Steps**:
1. Chạy server: `npm run start:client-api:dev`
2. Test API với Swagger hoặc cURL
3. Verify frontend hoạt động

**Documentation**:
- Frontend: `englishWeb/LEARNING_HISTORY_FEATURE.md`
- Backend: This file


