# Copilot Instructions – english-learning Backend

## Mission Context
- NestJS monorepo providing REST + Socket.IO gateway (`apps/client-api`), background cron worker, and Kafka email worker.
- Shared libs under `libs/` (Prisma repositories, guards, interceptors) must stay aligned across apps.
- Prisma schema stored at `libs/database/prisma/schema.prisma`; use migrations in `prisma/migrations/`.

## Core Workflows
- Bring infra up first: `docker compose up -d postgres redpanda minio redis`.
- Setup: `npm install` → `npm run prisma:generate` → `npm run prisma:migrate`.
- Client API dev server: `npm run start:client-api:dev` (Swagger at `/api/docs`).
- Background worker: `npx nest start background-worker --watch` shares same `.env`.
- Notification Kafka consumer: `npm run start:notification:dev` (needs SMTP envs).
- Build targets: `npm run build` or scoped `build:client-api`, `build:background-worker`.

## Architecture Patterns
- Each domain under `apps/client-api/src/domains/<feature>/` has `controller`, `service`, `repository`, DTOs, Swagger decorators, and sometimes Kafka producers.
- Shared request context: apply guards/interceptors from `libs/shared` (`RequestContextMiddleware`, `ResponseMessageInterceptor`).
- Repositories extend `PrismaRepository` (see `libs/database/src/repository`). Avoid direct `prisma` client usage in services.
- SocketIO gateway (`apps/client-api/src/app.gateway.ts`) forwards Kafka `notifications` topic; rooms named `user:{id}`.
- Background tasks defined in `apps/background-worker/src/jobs/`; schedule via `@Cron` decorators using `CronExpression`.

## Data & Messaging
- Kafka topic `notifications`: produced when user notifications are created; consumed by API (Socket push) and notification app (email).
- MinIO used for file storage via S3-compatible client; `S3_*` env vars required before uploading in domains like podcasts.
- Prisma `reindex-embeddings.ts` script rebuilds RAG vectors; requires `GEMINI_API_KEY` and Postgres `pgvector` extension running.

## Coding Conventions
- Two-space indent, single quotes, trailing commas (Prettier).
- DTOs suffixed `*.dto.ts`, controllers decorated with `@ResponseMessage('...')`, Swagger `@ApiTags`.
- Use `libs/shared/src/exceptions` for domain errors; wrap Kafka interactions with provided `KafkaService`.
- Update Swagger when adding endpoints to keep agent tools accurate (`SwaggerModule.setup`).

## Testing & Validation
- Unit tests: place `*.spec.ts` alongside services/controllers; run `npm run test`.
- E2E tests under `apps/client-api/test/`; run `npm run test:e2e` with a clean database schema.
- After schema changes: run `npm run prisma:migrate` and update seed data (`prisma/seed.ts`) if needed.

## Productivity Tips
- Check `AGENTS.md` and domain-level docs for pending TODOs (e.g., podcast repository, forgot-password mailer).
- Reuse shared types from `libs/shared/src/types` to keep contracts consistent across apps.
- Keep env variable additions documented in README or instructions so other teams sync easily.
