#!/bin/bash

# Script xem logs của các containers

SERVICE=$1

if [ -z "$SERVICE" ]; then
    echo "📋 Available services:"
    echo "  • postgres"
    echo "  • redis"
    echo "  • redpanda"
    echo "  • all (all services)"
    echo ""
    echo "Usage: ./dev-logs.sh <service>"
    echo "Example: ./dev-logs.sh postgres"
    echo "         ./dev-logs.sh all"
    exit 1
fi

case $SERVICE in
    postgres)
        docker logs -f english_learning_db_dev
        ;;
    redis)
        docker logs -f redis_dev
        ;;
    redpanda)
        docker logs -f redpanda_dev
        ;;
    all)
        docker compose -f docker-compose.dev.yml logs -f
        ;;
    *)
        echo "❌ Unknown service: $SERVICE"
        echo "Available: postgres, redis, redpanda, all"
        exit 1
        ;;
esac
