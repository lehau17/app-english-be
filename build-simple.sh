#!/bin/bash

# Script build Docker image đơn giản hơn với timeout cao
# Usage: ./build-simple.sh

set -e

echo "🐳 Building client-api with optimized settings..."
echo ""

# Build with Docker directly
docker build \
  --file Dockerfile \
  --target production \
  --build-arg APP_NAME=client-api \
  --tag lehau17/english-learning-client-api:latest \
  --progress=plain \
  --network=host \
  .

echo ""
echo "✅ Build completed!"
echo ""
echo "📋 Image info:"
docker images lehau17/english-learning-client-api:latest
