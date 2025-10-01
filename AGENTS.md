# Repository Guidelines

## Structure & Ownership
- `apps/client-api/`: HTTP + Socket.IO gateway, guard/middleware, Swagger at `/api/docs`, and domain modules (including the LangChain/Gemini agent).
- `apps/background-worker/`: scheduled Prisma jobs (dashboard cron) sharing database and shared modules with the API.
- `apps/notification/`: Kafka consumer for `notifications`, renders Pug templates, mails via `MailerModule`.
- `apps/english-learning/`: minimal shell backing specs/e2e; extend only if a gateway/BFF emerges.
- `libs/database/`: global `PrismaRepository` built from `libs/database/prisma/schema.prisma` with migrations in `prisma/`.
- `libs/shared/`: guards, filters, `@ResponseMessage`, AsyncLocal request context, Kafka module, JWT `TokenRepository`.
- `scripts/reindex-embeddings.ts` rebuilds RAG vectors; `uploads/` stores files; `dist/` holds builds.

## Build & Run
- `docker compose up -d postgres redpanda minio redis piper-tts vosk-asr` boots all infrastructure services including Postgres (pgvector), Kafka/Redpanda, Redis, MinIO, Piper TTS, and Vosk ASR.
- `npm run start:client-api:dev` serves `localhost:3334` with Swagger, Socket.IO, and agent tooling.
- `npx nest start background-worker --watch` executes cron jobs; share the API `.env` (notably `DATABASE_URL`).
- `npm run start:notification:dev` launches the Kafka mailer; ensure `KAFKA_BROKERS` and mail SMTP envs.
- `npm run build` or `build:*` writes to `dist/`; run `npm run prisma:migrate` first and seed when data is needed.
- `npm run reindex:embeddings` refreshes `knowledge_document.embedding_vector` (requires `GEMINI_API_KEY`).

### Quick start (local)
- `npm install` → `npm run prisma:generate` → `npm run prisma:migrate` → `npm run start:client-api:dev`.
- Swagger UI: `http://localhost:3334/api/docs` (hoặc cổng đặt trong `CLIENT_API_PORT`).

### AI Speaking Services
- `docker compose up -d piper-tts vosk-asr` starts TTS and ASR services.
- Alternative: `npm run mock:ai-speaking` runs mock TTS/ASR servers for development without Docker.
- See `apps/client-api/src/domains/ai-speaking/README.md` for detailed documentation.

### Notifications & Realtime
- Producer: any backend module can publish to Kafka via `KafkaService.send('notifications', payload)`; the Notification domain does this on create/broadcast.
- Socket.IO lives in Client API only:
  - `apps/client-api` hosts `EventsGateway` and a Kafka consumer that relays `notifications` topic → Socket.IO event `notification`.
  - Clients connect to the Client API Socket.IO server and may join a user room by passing `userId` as a query param (joins `user:{userId}`).
- Email delivery lives in `apps/notification` only:
  - The Notification microservice consumes Kafka topic `notifications` and sends email when `channel === 'email'` (others are ignored and handled by Socket path above).
  - Configure SMTP via `SMTP_HOST`, `SMTP_PORT`, `FROM`, optional `SMTP_TO` fallback.

## Configuration
- Environment expectations: `DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `KAFKA_BROKERS`, `SMTP_HOST`, `SMTP_PORT`, `FROM`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `GEMINI_API_KEY`, `API_BASE_URL`, optional `AGENT_ALLOW_WRITE`, `AGENT_FALLBACK_BEARER`.
- AI Speaking requires: `AI_SPEAKING_TTS_USE_HTTP`, `AI_SPEAKING_TTS_HTTP_URL`, `AI_SPEAKING_ASR_WS_URL`. See `.env.example` for full configuration.
- Keep Swagger output in sync so `SwaggerService` and agent tools (`api_search`, `call_api`) resolve new routes.

## Architecture Notes
- Socket responsibilities are centralized in Client API; the Notification service does not emit websockets.
- Notification fan-out flow:
  1) Teacher calls Broadcast API → create per-student notification records → publish Kafka event `notifications`.
  2) Client API consumes Kafka → emits Socket.IO `notification` to intended user.
  3) Notification microservice consumes Kafka → if channel is `email`, send email; ignore non-email events.

## After Coding Checklist (bắt buộc)
1) `npm run lint` và `npm run format` cho các file vừa thay đổi.
2) `npm run build` (hoặc `build:<app>`) – chắc chắn build không lỗi.
3) Chạy thử dev/prod nhanh: `start:client-api`/`start:notification`/background-worker nếu có đụng.
4) Nếu thay đổi Prisma schema, cập nhật migration + chạy `prisma:migrate`; xác nhận API/e2e vẫn xanh.
5) Ghi chú thay đổi env/kết nối dịch vụ (Kafka, MinIO, Redis) trong PR.

## Coding Style
- Stick to Nest structure (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, DTO suffixes); split controllers into `public-`/`private-` when behaviour diverges.
- Run `npm run format` (Prettier, 2 spaces, single quotes, trailing commas) and `npm run lint` (ESLint with `@app/...` aliases) before pushing.
- Use `RequestContextMiddleware`, `GlobalInterceptor`, and `@ResponseMessage` for consistent envelopes; rely on `TokenRepository` and `KafkaService`.

## Testing & Quality
- `npm run test` executes current Jest specs (`apps/background-worker`, `apps/english-learning`); add `*.spec.ts` alongside new modules.
- `npm run test:e2e` uses `apps/english-learning/test/jest-e2e.json`; point `DATABASE_URL` to a disposable schema, run `npm run prisma:migrate`, then seed.
- `npm run test:cov` writes `coverage/`; treat <80% on touched modules as a signal to add focused service/repository/tool tests.

## Commit & PRs
- Use `type : short imperative summary` (e.g. `fix : handle token refresh`, `FT : add swagger for gg-translation:module`).
- Rebase on `main`, attach CLI output or screenshots for behavioural changes, and surface schema/env/script adjustments in the PR description.
- Link issues, mention operational dependencies (Kafka topic, MinIO bucket, embeddings), and update this guide or Swagger when behaviour shifts.
