#!/bin/bash

# Script để build Docker images với tối ưu hóa
# Usage: ./docker-build.sh [service-name]
# Example: ./docker-build.sh client-api

set -e

SERVICE=${1:-all}

echo "🐳 Building Docker images..."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Loaded .env"
fi

# Set default values
export DOCKER_USERNAME=${DOCKER_USERNAME:-lehau17}
export IMAGE_TAG=${IMAGE_TAG:-latest}

echo "📦 Docker Username: $DOCKER_USERNAME"
echo "🏷️  Image Tag: $IMAGE_TAG"
echo ""

# Function to build a service
build_service() {
    local service=$1
    echo "🔨 Building $service..."
    
    # Build with BuildKit for better caching
    DOCKER_BUILDKIT=1 docker compose -f docker-compose.build.yml build \
        --progress=plain \
        --no-cache \
        $service
    
    if [ $? -eq 0 ]; then
        echo "✅ $service built successfully"
    else
        echo "❌ Failed to build $service"
        exit 1
    fi
}

# Build based on argument
case $SERVICE in
    client-api)
        build_service client-api
        ;;
    background-worker)
        build_service background-worker
        ;;
    notification)
        build_service notification
        ;;
    all)
        echo "🔨 Building all services..."
        build_service client-api
        build_service background-worker
        build_service notification
        ;;
    *)
        echo "❌ Unknown service: $SERVICE"
        echo "Available: client-api, background-worker, notification, all"
        exit 1
        ;;
esac

echo ""
echo "🎉 Build completed!"
echo ""
echo "📋 Images built:"
docker images | grep "english-learning"
echo ""
echo "🚀 To push to registry:"
echo "  docker push $DOCKER_USERNAME/english-learning-$SERVICE:$IMAGE_TAG"
