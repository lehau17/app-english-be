# AGENTS – english-learning (NestJS Backend)

> Last updated: 2025-11-28 — Tóm tắt: Backend NestJS với 34+ domains, AI Agent system, Prisma ORM, Kafka messaging.

Backend API monolith dựng bằng NestJS, Prisma ORM, Kafka (Redpanda), Redis, MinIO, Neo4j.

## Thống Kê Nhanh
- **4 apps**: `client-api` (main), `notification`, `background-worker`, `english-learning`
- **34+ domains** trong `apps/client-api/src/domains/`
- **36+ AI tools** trong `domains/agent/tools/`
- **80+ Prisma models** trong `libs/database/prisma/schema.prisma`

## Cấu Trúc Apps
| App | Mô tả | Port |
|-----|-------|------|
| `client-api` | Main API gateway, REST endpoints, Swagger | 3334 |
| `notification` | Email/push notification worker | - |
| `background-worker` | Cron jobs, Neo4j sync, async tasks | - |
| `english-learning` | Legacy app (deprecated) | - |

## Domains Chính (34+)
| Category | Domains |
|----------|---------|
| **Core Learning** | `course`, `lesson`, `classroom`, `assignment`, `activity`, `quiz` |
| **AI Features** | `agent`, `ai-speaking`, `activity-ai`, `conversation` |
| **User Management** | `auth`, `student`, `teacher`, `parent`, `parent-child` |
| **Content** | `podcast`, `podcast-comment`, `podcast-rating`, `vocabulary`, `vocabulary-v2`, `dictionary` |
| **Progress** | `progress`, `attempt`, `evaluation`, `leaderboard`, `certificate` |
| **System** | `notification`, `upload`, `payment`, `device-token`, `room`, `dashboard` |

## AI Agent System (`domains/agent/`)
### Services
- `LangChainAgentService`: Main agent for Admin/Teacher (36+ tools)
- `StudentAgentService`: Student-specific agent
- `ParentAgentService`: Parent-specific agent
- `RagService`: Knowledge base search
- `SqlService`: Database query execution

### Tools (36+)
| Category | Files | Tools Count |
|----------|-------|-------------|
| Analytics | `student-analytics`, `teacher-analytics`, `course-analytics`, `classroom-analytics`, `assignment-analytics`, `revenue-analytics`, `system-overview`, `class-performance`, `content-stats` | 9 |
| Attendance | `attendance-report.tool.ts` | 4 sub-tools |
| Speaking | `speaking-progress.tool.ts` | 4 sub-tools |
| Payment | `payment-tracker.tool.ts` | 4 sub-tools |
| Vocabulary | `flashcard-review.tool.ts`, `vocabulary-lookup` | 6 |
| Learning | `grammar-explainer`, `progress-tracker`, `upcoming-deadlines`, `podcast-history` | 4 |
| Export | `excel-export`, `pdf-export`, `word-export`, `chart-generator`, `report-advisor` | 5 |
| System | `sql`, `rag`, `graph-query`, `notification-sender`, `user-management`, `student-alert` | 6 |

### Thêm Tool Mới
1. Tạo `tools/my-new.tool.ts` với `@Injectable()` + `getTools(): DynamicStructuredTool[]`
2. Import và thêm vào `providers` trong `agent.module.ts`
3. Inject trong constructor của `langchain-agent.service.ts`
4. Thêm vào array `tools` với `...this.myNewTool.getTools()`
5. Cập nhật prompt với mô tả tool mới
6. Nếu tool trả chart, thêm tên vào `analyticsToolsList`

## Shared Libraries (`libs/`)
| Library | Mô tả |
|---------|-------|
| `database` | Prisma client, repository patterns, migrations |
| `shared` | Guards, interceptors, decorators, Kafka, JWT, GeminiService |

## Biến Môi Trường Quan Trọng
```env
DATABASE_URL=postgresql://...
CLIENT_API_PORT=3334
JWT_SECRET=...
JWT_ACCESS_EXPIRES_IN=7d
GEMINI_API_KEY=...
KAFKA_BROKERS=localhost:9092
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=...
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Lệnh Phát Triển
```bash
# Khởi động services
docker compose up -d postgres redpanda minio redis neo4j

# Cài đặt và setup
npm install
npm run prisma:generate
npm run prisma:migrate

# Chạy dev
npm run start:client-api:dev        # Main API
npm run start:notification:dev       # Notification worker
npx nest start background-worker --watch  # Background worker

# Build & Test
npm run build
npm run test
npm run test:cov
npm run test:e2e
```

## Kafka Topics
| Topic | Producer | Consumer | Mô tả |
|-------|----------|----------|-------|
| `notifications` | client-api | notification, client-api | Push notifications |
| `neo4j-sync` | client-api | background-worker | Neo4j data sync |

## Checklist Sau Khi Code
1. `npm run lint`
2. `npm run build`
3. Chạy `start:client-api:dev` và test endpoint
4. Nếu thay đổi Prisma schema: `npm run prisma:generate` và `npm run prisma:migrate`
5. Nếu thêm tool mới: cập nhật prompt và analyticsToolsList
