# AI Speaking Module

The AI Speaking module provides real-time conversational AI capabilities with text-to-speech (TTS) and automatic speech recognition (ASR) features.

## Architecture

This module consists of several key services:

- **AiSpeakingService**: Main orchestrator for AI conversations
- **AiSpeakingCoordinator**: Manages conversation flow and turn-taking
- **RealtimeTtsService**: Converts AI responses to speech
- **RealtimeAsrService**: Converts user speech to text
- **ConversationDesignerService**: Designs conversation scenarios
- **AiSpeakingHealthService**: Validates TTS/ASR service availability on startup

## Prerequisites

### Option 1: Docker Services (Recommended)

The project includes Docker services for TTS and ASR:

```bash
# Start all services including TTS and ASR
docker compose up -d

# Check services are running
docker compose ps
```

Services:
- **piper-tts**: Text-to-speech service (port 10200)
- **vosk-asr**: Speech recognition service (port 2700)

### Option 2: Mock Servers (Development)

For local development without Docker:

```bash
# Terminal 1: Mock TTS Server
node mock-tts-server.js

# Terminal 2: Mock ASR Server  
node mock-asr-server.js
```

## Environment Configuration

Add these variables to your `.env` file:

```env
# TTS Configuration
AI_SPEAKING_TTS_USE_HTTP=true
AI_SPEAKING_TTS_HTTP_URL=http://localhost:10200
AI_SPEAKING_TTS_VOICE=en_US-lessac-medium

# Alternative: Command-line TTS (requires Piper installed locally)
# AI_SPEAKING_TTS_USE_HTTP=false
# AI_SPEAKING_TTS_COMMAND=piper
# AI_SPEAKING_TTS_MODEL_PATH=/path/to/model.onnx

# ASR Configuration
AI_SPEAKING_ASR_WS_URL=ws://localhost:2700
AI_SPEAKING_ASR_AUDIO_FORMAT=pcm16
AI_SPEAKING_ASR_SAMPLE_RATE=16000

# Health Check Configuration (optional)
AI_SPEAKING_HEALTH_SKIP=false
AI_SPEAKING_HEALTH_TIMEOUT_MS=3000
```

### Using Docker Services

```env
AI_SPEAKING_TTS_USE_HTTP=true
AI_SPEAKING_TTS_HTTP_URL=http://localhost:10200
AI_SPEAKING_ASR_WS_URL=ws://localhost:2700
```

### Using Mock Services

```env
AI_SPEAKING_TTS_USE_HTTP=true
AI_SPEAKING_TTS_HTTP_URL=http://localhost:5400
AI_SPEAKING_ASR_WS_URL=ws://localhost:2700
```

## API Endpoints

### Health Check
```
GET /api/ai-speaking/health
```

Returns status of TTS and ASR services.

### Start Session
```
POST /api/ai-speaking/sessions
```

Initiates a new AI speaking session.

### Socket.IO Events

The module communicates via Socket.IO for real-time interaction:

#### Client → Server
- `ai-speaking:start-session`: Start a new conversation
- `ai-speaking:audio-chunk`: Send audio data for transcription
- `ai-speaking:end-turn`: Signal end of user's turn

#### Server → Client
- `ai-speaking:tts-chunk`: Receive AI speech audio chunks
- `ai-speaking:partial-transcript`: Partial speech recognition result
- `ai-speaking:final-transcript`: Final speech recognition result
- `ai-speaking:turn-complete`: AI turn completed

## TTS Service Details

### HTTP API Mode (Default)

The TTS service expects a JSON API:

**Request:**
```json
POST /stream
{
  "text": "Hello, how are you?",
  "voice": "en_US-lessac-medium"
}
```

**Response:**
```json
{
  "success": true,
  "chunks": ["base64_audio_chunk_1", "base64_audio_chunk_2"],
  "format": "wav",
  "sample_rate": 22050
}
```

### Command-line Mode

If using Piper command-line (requires local installation):

```bash
# Install Piper
# See: https://github.com/rhasspy/piper

# Download a voice model
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-en-us-lessac-medium.tar.gz
tar -xzf voice-en-us-lessac-medium.tar.gz

# Configure
AI_SPEAKING_TTS_USE_HTTP=false
AI_SPEAKING_TTS_COMMAND=piper
AI_SPEAKING_TTS_MODEL_PATH=/path/to/en_US-lessac-medium.onnx
```

## ASR Service Details

The ASR service uses WebSocket protocol compatible with Vosk server.

**Message Format:**

1. Config message:
```json
{
  "config": {
    "sample_rate": 16000,
    "format": "pcm16"
  }
}
```

2. Audio chunks:
```json
{
  "audio": "base64_encoded_audio_data"
}
```

3. End of audio:
```json
{
  "eof": 1
}
```

**Server Responses:**

1. Partial results (during recognition):
```json
{
  "partial": "hello how are",
  "confidence": 0.85
}
```

2. Final result:
```json
{
  "text": "hello how are you",
  "confidence": 0.92,
  "result": [
    {"word": "hello", "start": 0.0, "end": 0.5, "conf": 0.95},
    {"word": "how", "start": 0.5, "end": 0.8, "conf": 0.90}
  ]
}
```

## Troubleshooting

### TTS Service Not Available

If you see warnings like:
```
Unable to connect to TTS service
```

**Solutions:**
1. Check Docker service is running: `docker compose ps piper-tts`
2. Try restarting: `docker compose restart piper-tts`
3. Check logs: `docker compose logs piper-tts`
4. For mock server: Ensure `node mock-tts-server.js` is running

### ASR Service Not Available

If you see warnings like:
```
Unable to connect to ASR websocket
```

**Solutions:**
1. Check Docker service is running: `docker compose ps vosk-asr`
2. Try restarting: `docker compose restart vosk-asr`
3. Check logs: `docker compose logs vosk-asr`
4. For mock server: Ensure `node mock-asr-server.js` is running

### Health Check Timeout

If health checks timeout on startup:
```env
# Increase timeout
AI_SPEAKING_HEALTH_TIMEOUT_MS=5000

# Or skip health checks (not recommended for production)
AI_SPEAKING_HEALTH_SKIP=true
```

## Development

### Running with Mock Services

1. Start mock servers:
```bash
# Terminal 1
node mock-tts-server.js

# Terminal 2
node mock-asr-server.js
```

2. Update .env:
```env
AI_SPEAKING_TTS_HTTP_URL=http://localhost:5400
AI_SPEAKING_ASR_WS_URL=ws://localhost:2700
```

3. Start the API:
```bash
npm run start:client-api:dev
```

### Running with Docker

1. Start all services:
```bash
docker compose up -d
```

2. Update .env:
```env
AI_SPEAKING_TTS_HTTP_URL=http://localhost:10200
AI_SPEAKING_ASR_WS_URL=ws://localhost:2700
```

3. Start the API:
```bash
npm run start:client-api:dev
```

## Testing

The mock servers provide predictable responses for testing:

- **Mock TTS**: Returns base64-encoded mock audio chunks
- **Mock ASR**: Returns incrementally built phrases like "Hello how are you"

This allows testing the full conversation flow without requiring actual speech synthesis or recognition.

## Production Deployment

For production:

1. Use real Piper TTS service (via Docker or dedicated server)
2. Use real Vosk ASR service (via Docker or dedicated server)
3. Configure proper voice models for your language
4. Set `AI_SPEAKING_HEALTH_SKIP=false` to validate services on startup
5. Monitor service health and logs
6. Consider load balancing for high traffic

## References

- [Piper TTS](https://github.com/rhasspy/piper)
- [Vosk ASR](https://alphacephei.com/vosk/)
- [Wyoming Protocol](https://github.com/rhasspy/wyoming)
