#!/bin/bash
# Deploy Piper TTS infrastructure

set -euo pipefail

echo "1. Downloading voice models..."
./scripts/setup-piper-voices.sh

echo "2. Building Docker image..."
docker-compose -f docker-compose.piper-tts.yml build

echo "3. Starting Piper TTS server..."
docker-compose -f docker-compose.piper-tts.yml up -d

echo "4. Waiting for health check..."
sleep 10

echo "5. Testing TTS synthesis..."
curl -X POST http://localhost:8000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voice":"en_US-amy-medium","speakerId":0}' \
  --output test-output.wav

if [[ -f test-output.wav && -s test-output.wav ]]; then
  echo "✓ Piper TTS deployment successful!"
  rm test-output.wav
else
  echo "✗ Piper TTS synthesis test failed"
  exit 1
fi

echo ""
echo "Piper TTS server running at http://localhost:8000"
echo "Check logs: docker-compose -f docker-compose.piper-tts.yml logs -f"
