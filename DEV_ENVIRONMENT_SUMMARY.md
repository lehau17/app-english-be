# Development Environment - Quick Summary

## Tạo ra gì?

Môi trường development đơn giản với **chỉ 3 containers** thay vì 10+ containers của production.

## Files đã tạo

### 1. `docker-compose.dev.yml`
Docker compose file chỉ chứa 3 services cơ bản:
- **postgres**: PostgreSQL database với pgvector
- **redis**: Redis cache (không password)
- **redpanda**: Kafka-compatible message broker

### 2. `.env.dev`
File environment variables cho development với cấu hình đơn giản:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/english_learning
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:19092
```

### 3. `dev-start.sh`
Script khởi động nhanh môi trường dev:
- Start 3 containers
- Check health của từng service
- Hiển thị URLs và next steps

### 4. `dev-stop.sh`
Script dừng môi trường dev một cách sạch sẽ.

### 5. `dev-logs.sh`
Script xem logs của từng service hoặc tất cả:
```bash
./dev-logs.sh postgres
./dev-logs.sh redis
./dev-logs.sh redpanda
./dev-logs.sh all
```

### 6. `DEV_ENVIRONMENT.md`
Documentation đầy đủ về:
- Quick start guide
- Service URLs & credentials
- Troubleshooting
- Tips & best practices

## Cách dùng

### Khởi động môi trường
```bash
./dev-start.sh
```

### Chạy migrations
```bash
npm run prisma:generate
npm run prisma:migrate
```

### Start backend API
```bash
npm run start:client-api:dev
```

### Dừng môi trường
```bash
./dev-stop.sh
```

## Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL | `localhost:5432` | `postgres` / `postgres` |
| Redis | `localhost:6379` | No password |
| Kafka | `localhost:19092` | - |
| Redpanda Console | `http://localhost:8000` | - |

## Lợi ích

✅ **Nhanh**: Chỉ 3 containers thay vì 10+
✅ **Đơn giản**: Không cần Neo4j, MinIO, AI services cho dev
✅ **Tiết kiệm**: Ít RAM, CPU hơn
✅ **Dễ debug**: Ít services, dễ troubleshoot
✅ **Isolated**: Không ảnh hưởng production setup

## So sánh với Production

| Feature | Development | Production |
|---------|-------------|------------|
| Containers | 3 | 10+ |
| Services | postgres, redis, redpanda | + neo4j, minio, piper, vosk, apps |
| Redis Auth | Không | Có password |
| Network | Isolated | Shared |
| Use Case | Local dev | Production deploy |

## Scripts tạo

- ✅ `dev-start.sh` - Start environment
- ✅ `dev-stop.sh` - Stop environment
- ✅ `dev-logs.sh` - View logs
- Đã cấp quyền thực thi cho tất cả scripts

## Next Steps

1. Test môi trường dev:
   ```bash
   ./dev-start.sh
   npm run prisma:migrate
   npm run start:client-api:dev
   ```

2. Update AGENTS.md với hướng dẫn dev environment mới

3. Commit changes:
   ```bash
   git add docker-compose.dev.yml .env.dev dev-*.sh DEV_ENVIRONMENT.md
   git commit -m "FEA: Add simplified development environment with 3 containers"
   ```

## Troubleshooting

### Port conflicts
Thay đổi port trong `.env.dev`:
```bash
POSTGRES_PORT=5433
REDIS_PORT=6380
```

### Reset data
```bash
docker compose -f docker-compose.dev.yml down -v
./dev-start.sh
npm run prisma:migrate
```

### View logs
```bash
./dev-logs.sh all
```

## Documentation

Xem `DEV_ENVIRONMENT.md` cho hướng dẫn đầy đủ.
