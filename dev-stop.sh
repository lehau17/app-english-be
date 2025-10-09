#!/bin/bash

# Script dừng môi trường development

echo "🛑 Stopping development environment..."

docker compose -f docker-compose.dev.yml down

echo ""
echo "✅ Development environment stopped!"
echo ""
echo "💡 Tips:"
echo "  • To remove volumes: docker compose -f docker-compose.dev.yml down -v"
echo "  • To restart: ./dev-start.sh"
