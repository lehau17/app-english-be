#!/bin/bash

# Script khởi động môi trường development với 3 containers cơ bản

echo "🚀 Starting development environment..."
echo ""

# Kiểm tra docker có chạy không
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Load environment variables
if [ -f .env.dev ]; then
    export $(cat .env.dev | grep -v '^#' | xargs)
    echo "✅ Loaded .env.dev"
else
    echo "⚠️  .env.dev not found, using defaults"
fi

echo ""
echo "📦 Starting containers..."
docker compose -f docker-compose.dev.yml up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Kiểm tra health của từng service
echo ""
echo "🔍 Checking service health..."

# Check Postgres
if docker exec english_learning_db_dev pg_isready -U postgres > /dev/null 2>&1; then
    echo "  ✅ PostgreSQL is ready"
else
    echo "  ⏳ PostgreSQL is starting..."
fi

# Check Redis
if docker exec redis_dev redis-cli ping > /dev/null 2>&1; then
    echo "  ✅ Redis is ready"
else
    echo "  ⏳ Redis is starting..."
fi

# Check Redpanda
if docker exec redpanda_dev rpk cluster info > /dev/null 2>&1; then
    echo "  ✅ Redpanda is ready"
else
    echo "  ⏳ Redpanda is starting..."
fi

echo ""
echo "🎉 Development environment started!"
echo ""
echo "📋 Service URLs:"
echo "  • PostgreSQL: localhost:5432"
echo "  • Redis: localhost:6379"
echo "  • Redpanda (Kafka): localhost:19092"
echo "  • Redpanda Console: http://localhost:8000"
echo ""
echo "📝 Next steps:"
echo "  1. Run: npm run prisma:generate"
echo "  2. Run: npm run prisma:migrate"
echo "  3. Run: npm run start:client-api:dev"
echo ""
echo "🛑 To stop: ./dev-stop.sh or docker compose -f docker-compose.dev.yml down"
