#!/bin/bash

# Deployment script for English Learning Backend
# This script pulls the latest Docker images and restarts services

set -e

echo "🚀 Starting deployment..."

# Load environment variables
if [ -f .env ]; then
  echo "📝 Loading environment variables..."
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "⚠️  Warning: .env file not found"
fi

# Set default values if not in .env
export IMAGE_TAG=${IMAGE_TAG:-latest}
export DOCKER_USERNAME=${DOCKER_USERNAME:-your-docker-username}

echo "📦 Pulling latest Docker images..."
docker compose -f docker-compose.prod.yml pull client-api background-worker notification

echo "🔄 Stopping old containers..."
docker compose -f docker-compose.prod.yml stop client-api background-worker notification

echo "🗑️  Removing old containers..."
docker compose -f docker-compose.prod.yml rm -f client-api background-worker notification

echo "🔧 Running database migrations..."
# Run migrations using the new client-api image
docker compose -f docker-compose.prod.yml run --rm client-api npm run prisma:migrate deploy

echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to be healthy..."
sleep 10

echo "🔍 Checking service status..."
docker compose -f docker-compose.prod.yml ps

echo "✅ Deployment completed successfully!"
echo ""
echo "📊 View logs with:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🔍 Check health status:"
echo "  curl http://localhost:3334/api/health"
