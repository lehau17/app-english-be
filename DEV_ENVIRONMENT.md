# Development Environment Setup

Môi trường development đơn giản với 3 containers cần thiết cho backend.

## 🎯 Mục đích

Thay vì chạy toàn bộ stack production (10+ containers), môi trường dev chỉ chạy 3 services cơ bản:
- **PostgreSQL**: Database
- **Redis**: Cache & Session
- **Redpanda**: Kafka-compatible message broker

## 🚀 Quick Start

### 1. Khởi động môi trường

```bash
# Cách 1: Dùng script (khuyến nghị)
chmod +x dev-start.sh dev-stop.sh dev-logs.sh
./dev-start.sh

# Cách 2: Dùng docker compose trực tiếp
docker compose -f docker-compose.dev.yml up -d
```

### 2. Chạy Prisma migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 3. Khởi động backend API

```bash
npm run start:client-api:dev
```

## 🛑 Dừng môi trường

```bash
# Cách 1: Dùng script
./dev-stop.sh

# Cách 2: Dùng docker compose
docker compose -f docker-compose.dev.yml down

# Xóa luôn volumes (data sẽ mất!)
docker compose -f docker-compose.dev.yml down -v
```

## 📋 Xem logs

```bash
# Xem logs của một service cụ thể
./dev-logs.sh postgres
./dev-logs.sh redis
./dev-logs.sh redpanda

# Xem logs tất cả services
./dev-logs.sh all

# Hoặc dùng docker compose
docker compose -f docker-compose.dev.yml logs -f
docker compose -f docker-compose.dev.yml logs -f postgres
```

## 🔧 Configuration

File `.env.dev` chứa cấu hình mặc định cho development:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/english_learning?schema=public

# Redis (không password)
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:19092
```

## 📡 Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL | `localhost:5432` | `postgres` / `postgres` |
| Redis | `localhost:6379` | No password |
| Redpanda (Kafka) | `localhost:19092` | - |
| Redpanda Console | http://localhost:8000 | - |

## 🔍 Kiểm tra health

```bash
# PostgreSQL
docker exec english_learning_db_dev pg_isready -U postgres

# Redis
docker exec redis_dev redis-cli ping

# Redpanda
docker exec redpanda_dev rpk cluster info
```

## 🐛 Troubleshooting

### Port đã được sử dụng

Nếu port 5432, 6379, hoặc 19092 đã được dùng bởi service khác:

```bash
# Kiểm tra port đang dùng
lsof -i :5432
lsof -i :6379
lsof -i :19092

# Thay đổi port trong .env.dev
POSTGRES_PORT=5433
REDIS_PORT=6380
# Rồi restart
```

### Container không start

```bash
# Xem logs để debug
docker logs english_learning_db_dev
docker logs redis_dev
docker logs redpanda_dev

# Restart container
docker compose -f docker-compose.dev.yml restart postgres
docker compose -f docker-compose.dev.yml restart redis
docker compose -f docker-compose.dev.yml restart redpanda
```

### Xóa data và reset từ đầu

```bash
# Dừng và xóa tất cả (bao gồm volumes)
docker compose -f docker-compose.dev.yml down -v

# Start lại
./dev-start.sh

# Chạy lại migrations
npm run prisma:migrate
```

## 📊 Redpanda Console

Truy cập http://localhost:8000 để:
- Xem topics Kafka
- Monitor messages
- Kiểm tra consumer groups
- Debug Kafka issues

## 🔄 So sánh với Production

| Feature | Development | Production |
|---------|-------------|------------|
| Containers | 3 (postgres, redis, redpanda) | 10+ (thêm minio, neo4j, piper, vosk, apps) |
| Redis Password | Không | Có |
| Neo4j | Không cần | Có |
| MinIO (S3) | Không cần | Có |
| AI Speaking | Không cần | Có (piper-tts, vosk-asr) |
| Network | Isolated | Shared network |
| Volumes | Persistent | Persistent |

## 💡 Tips

1. **Chỉ chạy backend API**: Môi trường này chỉ chạy dependencies, API chạy trực tiếp với `npm run start:client-api:dev`

2. **Hot reload**: Khi chạy API bằng npm, code sẽ tự động reload khi có thay đổi

3. **Database GUI**: Dùng Prisma Studio để xem data:
   ```bash
   npm run prisma:studio
   ```

4. **Kafka testing**: Dùng Redpanda Console tại http://localhost:8000

5. **Redis CLI**: Kết nối vào Redis để test:
   ```bash
   docker exec -it redis_dev redis-cli
   ```

## 🔐 Security Note

⚠️ Môi trường này CHỈ dùng cho development local. Không dùng cho production vì:
- Redis không có password
- PostgreSQL dùng credentials mặc định
- Network không được bảo mật
- Không có backup

## 📝 Next Steps

Sau khi môi trường dev đã chạy:

1. ✅ Chạy Prisma migrations
2. ✅ Seed database nếu cần: `npm run prisma:seed` (nếu có)
3. ✅ Start backend: `npm run start:client-api:dev`
4. ✅ Start frontend: `cd ../englishWeb && npm run dev`
5. ✅ Test features

## 🤝 Contributing

Nếu cần thêm service vào môi trường dev (ví dụ: neo4j, minio), edit file `docker-compose.dev.yml` và update script tương ứng.
