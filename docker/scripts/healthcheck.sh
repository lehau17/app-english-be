#!/bin/bash
# Piper TTS health check

set -euo pipefail

HEALTH_URL="http://localhost:8000/health"
TIMEOUT=5

response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$HEALTH_URL")

if [[ "$response" == "200" ]]; then
  echo "OK: Piper TTS server healthy"
  exit 0
else
  echo "ERROR: Piper TTS server unhealthy (HTTP $response)"
  exit 1
fi
