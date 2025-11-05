# Audio Extraction Service - Documentation

## 📦 **Đã Implement:**

### 1. **AudioExtractionService**
File: `apps/client-api/src/domains/podcast/service/audio-extraction.service.ts`

**Features:**
- ✅ Extract audio từ video → MP3 (192kbps, stereo)
- ✅ Extract audio từ video → WAV (16kHz, mono - optimal cho Whisper API)
- ✅ Get audio metadata (duration, format, size)
- ✅ Validate file exists
- ✅ Cleanup extracted files
- ✅ Check FFmpeg availability

### 2. **Test Endpoints**
**Base URL:** `http://localhost:3334/api/private/v1/podcasts`

#### **A. Check FFmpeg Installation**
```bash
GET /test/check-ffmpeg

Response:
{
  "available": true,
  "message": "FFmpeg is installed and ready"
}
```

#### **B. Extract Audio (MP3)**
```bash
POST /test/extract-audio
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "videoPath": "/absolute/path/to/video.mp4",
  "format": "mp3"
}

Response:
{
  "success": true,
  "audioPath": "/absolute/path/to/video.mp3",
  "format": "mp3",
  "duration": 120.5,
  "sizeBytes": 2457600,
  "sizeMB": "2.34"
}
```

#### **C. Extract Audio (WAV for Whisper)**
```bash
POST /test/extract-audio
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "videoPath": "/absolute/path/to/video.mp4",
  "format": "wav"
}
```

---

## 🛠️ **Installation Requirements:**

### **1. Install FFmpeg (macOS)**
```bash
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### **2. Install FFmpeg (Ubuntu/Debian)**
```bash
sudo apt update
sudo apt install ffmpeg

# Verify
ffmpeg -version
```

### **3. Install FFmpeg (Windows)**
1. Download từ: https://ffmpeg.org/download.html
2. Extract vào `C:\ffmpeg`
3. Thêm `C:\ffmpeg\bin` vào PATH

---

## 🧪 **Testing Guide:**

### **Step 1: Chuẩn bị video test**
```bash
# Download sample video (nếu chưa có)
curl -o /tmp/test_video.mp4 https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4
```

### **Step 2: Start backend**
```bash
cd english-learning
npm run start:client-api:dev
```

### **Step 3: Check FFmpeg**
```bash
curl http://localhost:3334/api/private/v1/podcasts/test/check-ffmpeg \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Step 4: Extract audio**
```bash
# MP3
curl -X POST http://localhost:3334/api/private/v1/podcasts/test/extract-audio \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "videoPath": "/tmp/test_video.mp4",
    "format": "mp3"
  }'

# WAV (for Whisper)
curl -X POST http://localhost:3334/api/private/v1/podcasts/test/extract-audio \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "videoPath": "/tmp/test_video.mp4",
    "format": "wav"
  }'
```

### **Step 5: Verify output**
```bash
# Check file exists
ls -lh /tmp/test_video.mp3
ls -lh /tmp/test_video.wav

# Play audio (macOS)
afplay /tmp/test_video.mp3

# Get audio info
ffprobe /tmp/test_video.mp3
```

---

## 📝 **Service API Reference:**

### **extractToMp3(videoPath, outputPath?)**
```typescript
const result = await audioExtractionService.extractToMp3('/path/to/video.mp4');

// Result:
{
  audioPath: '/path/to/video.mp3',
  format: 'mp3',
  duration: 120.5,  // seconds
  size: 2457600     // bytes
}
```

### **extractToWav(videoPath, outputPath?)**
```typescript
// Optimal for Whisper API
const result = await audioExtractionService.extractToWav('/path/to/video.mp4');

// Output: 16kHz, mono, WAV format
```

### **checkFFmpegAvailable()**
```typescript
const available = await audioExtractionService.checkFFmpegAvailable();
if (!available) {
  throw new Error('FFmpeg not installed!');
}
```

### **cleanup(audioPath)**
```typescript
// Delete extracted audio file
await audioExtractionService.cleanup('/path/to/audio.mp3');
```

---

## 🚀 **Next Steps:**

### **Phase 1: Video Upload Integration** (TODO)
```typescript
// apps/client-api/src/domains/podcast/service/podcast.service.ts

async createVideopodcast(videoFile: Express.Multer.File) {
  // 1. Upload video to MinIO/S3
  const videoUrl = await this.uploadService.upload(videoFile);

  // 2. Download video to temp
  const tempVideoPath = `/tmp/${Date.now()}_${videoFile.originalname}`;
  await this.downloadFile(videoUrl, tempVideoPath);

  // 3. Extract audio
  const audioResult = await this.audioExtractionService.extractToWav(tempVideoPath);

  // 4. Send to Whisper API
  const transcript = await this.whisperService.transcribe(audioResult.audioPath);

  // 5. Cleanup temp files
  await this.audioExtractionService.cleanup(audioResult.audioPath);
  await fs.unlink(tempVideoPath);

  // 6. Save podcast with transcript
  return this.prisma.podcast.create({
    data: {
      videoUrl,
      transcript,
      mediaType: 'video',
      // ...
    }
  });
}
```

### **Phase 2: Whisper API Integration** (TODO)
```typescript
// apps/client-api/src/domains/podcast/service/whisper.service.ts

async transcribe(audioPath: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(audioPath));
  formData.append('model', 'whisper-1');

  const response = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    formData,
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
    },
  );

  return response.data.text;
}
```

---

## ⚠️ **Limitations & Considerations:**

1. **File Size**: FFmpeg có thể xử lý file lớn, nhưng cần đủ RAM/disk space
2. **Processing Time**: ~2-5 giây cho mỗi phút video
3. **Whisper API Cost**: ~$0.006/phút (~$0.36 cho video 1 giờ)
4. **Whisper File Limit**: Max 25MB per request (nên split nếu file lớn)

---

## 🎯 **Cost Estimation:**

| Service | Cost | Notes |
|---------|------|-------|
| FFmpeg | **FREE** | Opensource, chạy local |
| OpenAI Whisper | **$0.006/min** | ~$0.36 cho 1h video |
| Storage (MinIO) | **FREE** | Self-hosted |
| Processing Time | 2-5s/min | Depends on server specs |

**Example:** Video 10 phút
- FFmpeg: $0
- Whisper: $0.06
- **Total: $0.06**

---

## 📚 **References:**

- FFmpeg Docs: https://ffmpeg.org/documentation.html
- fluent-ffmpeg: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
- OpenAI Whisper API: https://platform.openai.com/docs/guides/speech-to-text

---

**Status:** ✅ Service implemented & ready for testing
**Last Updated:** 2025-11-04

