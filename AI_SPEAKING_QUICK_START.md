# AI Speaking - Quick Start Guide

## 🚀 Quick Setup (Docker)

### 1. Start All Services
```bash
# Start infrastructure and AI services
docker compose up -d

# Check all services are running
docker compose ps
```

Expected services:
- ✅ postgres (5432)
- ✅ redpanda (19092) 
- ✅ redis (6379)
- ✅ minio (9000, 9001)
- ✅ piper-tts (10200) - Text-to-Speech
- ✅ vosk-asr (2700) - Speech Recognition

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and set:
```env
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/english_learning
JWT_SECRET=your-secret-key
GEMINI_API_KEY=your-gemini-key

# AI Speaking (Docker services)
AI_SPEAKING_TTS_USE_HTTP=true
AI_SPEAKING_TTS_HTTP_URL=http://localhost:10200
AI_SPEAKING_ASR_WS_URL=ws://localhost:2700
```

### 3. Setup Database
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start API
```bash
npm run start:client-api:dev
```

Access:
- 📖 API Docs: http://localhost:3334/api/docs
- 🧪 Health Check: http://localhost:3334/api/ai-speaking/health

---

## 🧪 Alternative: Mock Servers (No Docker)

For local development without Docker:

### 1. Start Mock Services
```bash
# Terminal 1: Mock TTS
npm run mock:tts

# Terminal 2: Mock ASR  
npm run mock:asr
```

### 2. Configure for Mock
Edit `.env`:
```env
AI_SPEAKING_TTS_HTTP_URL=http://localhost:5400
AI_SPEAKING_ASR_WS_URL=ws://localhost:2700
```

### 3. Start API
```bash
npm run start:client-api:dev
```

---

## 🧪 Testing

### Check Service Health
```bash
curl http://localhost:3334/api/ai-speaking/health
```

Expected response:
```json
{
  "statusCode": 200,
  "message": "AI Speaking services are operational",
  "data": {
    "tts": "available",
    "asr": "available"
  }
}
```

### Test TTS Service
```bash
# Docker service
curl -X POST http://localhost:10200/stream \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voice":"en_US-lessac-medium"}'

# Mock service
curl http://localhost:5400/health
```

### Test ASR Service
```bash
# Install wscat if needed: npm install -g wscat

# Docker service
wscat -c ws://localhost:2700

# Send config
{"config":{"sample_rate":16000,"format":"pcm16"}}
```

---

## 🐛 Troubleshooting

### Services Won't Start
```bash
# Check Docker logs
docker compose logs piper-tts
docker compose logs vosk-asr

# Restart services
docker compose restart piper-tts vosk-asr
```

### API Can't Connect
1. Verify services are running:
```bash
docker compose ps | grep -E "piper-tts|vosk-asr"
```

2. Test connectivity:
```bash
curl http://localhost:10200/health || echo "TTS not responding"
wscat -c ws://localhost:2700 || echo "ASR not responding"
```

3. Check ports are not in use:
```bash
lsof -i :10200  # TTS
lsof -i :2700   # ASR
```

### Skip Health Checks
If services are slow to start, temporarily skip health checks:
```env
AI_SPEAKING_HEALTH_SKIP=true
```

---

## 📚 Documentation

- **Full Documentation**: `apps/client-api/src/domains/ai-speaking/README.md`
- **API Reference**: http://localhost:3334/api/docs
- **Configuration**: `.env.example`

---

## 🎯 What's Next?

1. ✅ Services running
2. ✅ API started  
3. ✅ Health check passing
4. 🎤 Start using AI Speaking features via Socket.IO or REST API

Check the full README for Socket.IO event documentation and integration examples.
