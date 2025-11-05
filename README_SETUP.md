# 📚 Setup Documentation Index

Danh sách đầy đủ tài liệu hướng dẫn cài đặt và vận hành hệ thống.

---

## 🚀 **Quick Links:**

### **🐧 Ubuntu/Linux Users:**
1. 📖 [**SETUP_UBUNTU.md**](SETUP_UBUNTU.md) - Hướng dẫn setup toàn bộ dự án
2. 🎙️ [**WHISPER_UBUNTU.md**](WHISPER_UBUNTU.md) - Cài đặt Faster-Whisper trên Ubuntu

### **🍎 macOS Users:**
1. 🎙️ [**WHISPER_QUICKSTART.md**](WHISPER_QUICKSTART.md) - Setup Whisper nhanh (5 phút)
2. 📖 [**WHISPER_SETUP.md**](WHISPER_SETUP.md) - Hướng dẫn chi tiết Whisper

### **📦 Tất cả Platform:**
1. 🎯 [**AGENTS.md**](AGENTS.md) - Tổng quan dự án & quy ước
2. 🎥 [**VIDEO_UPLOAD_IMPLEMENTATION.md**](VIDEO_UPLOAD_IMPLEMENTATION.md) - Video upload & auto-transcribe
3. 🔊 [**AUDIO_EXTRACTION_SERVICE.md**](AUDIO_EXTRACTION_SERVICE.md) - FFmpeg audio extraction
4. 🧪 [**TEST_RESULTS.md**](TEST_RESULTS.md) - Kết quả testing

---

## 📋 **Chọn hướng dẫn phù hợp:**

### **Nếu bạn đang dùng Ubuntu Server/Desktop:**
```
1. SETUP_UBUNTU.md          ← Bắt đầu tại đây
2. WHISPER_UBUNTU.md         ← Setup Whisper
3. VIDEO_UPLOAD_IMPLEMENTATION.md  ← Hiểu feature
```

### **Nếu bạn đang dùng macOS:**
```
1. AGENTS.md                 ← Đọc tổng quan
2. WHISPER_QUICKSTART.md     ← Setup Whisper nhanh
3. VIDEO_UPLOAD_IMPLEMENTATION.md  ← Hiểu feature
```

### **Nếu bạn chỉ cần setup Whisper:**
```
Ubuntu:  WHISPER_UBUNTU.md
macOS:   WHISPER_QUICKSTART.md
Details: WHISPER_SETUP.md
```

### **Nếu bạn cần troubleshoot:**
```
1. WHISPER_SETUP.md          ← Troubleshooting section
2. SETUP_UBUNTU.md           ← Troubleshooting section
3. TEST_RESULTS.md           ← Check expected results
```

---

## 🎯 **Quick Commands:**

### **Ubuntu:**
```bash
# Full setup
cat SETUP_UBUNTU.md | less

# Just Whisper
cat WHISPER_UBUNTU.md | less
```

### **macOS:**
```bash
# Quick Whisper setup
cat WHISPER_QUICKSTART.md

# Detailed guide
cat WHISPER_SETUP.md
```

---

## 📁 **File Structure:**

```
english-learning/
├── AGENTS.md                          ← Tổng quan dự án
├── SETUP_UBUNTU.md                    ← ⭐ Ubuntu full setup
├── WHISPER_UBUNTU.md                  ← ⭐ Whisper on Ubuntu
├── WHISPER_QUICKSTART.md              ← Quick Whisper (macOS/Ubuntu)
├── WHISPER_SETUP.md                   ← Detailed Whisper guide
├── VIDEO_UPLOAD_IMPLEMENTATION.md     ← Video upload docs
├── AUDIO_EXTRACTION_SERVICE.md        ← FFmpeg audio docs
├── TEST_RESULTS.md                    ← Test results
├── README_SETUP.md                    ← This file
├── scripts/
│   └── transcribe.py                  ← Python transcription script
└── apps/
    └── client-api/
        └── src/domains/podcast/service/
            ├── whisper.service.ts     ← NestJS Whisper service
            ├── video-processing.service.ts
            └── audio-extraction.service.ts
```

---

## ⚡ **Most Common Tasks:**

### **1. First time setup on Ubuntu:**
```bash
# Follow this order:
1. Read: SETUP_UBUNTU.md
2. Run commands from that file
3. Read: WHISPER_UBUNTU.md for transcription
4. Test with video upload
```

### **2. Setup only Whisper transcription:**
```bash
# Ubuntu:
pip install faster-whisper
# See: WHISPER_UBUNTU.md

# macOS:
pip install faster-whisper
# See: WHISPER_QUICKSTART.md
```

### **3. Troubleshoot Whisper not working:**
```bash
# Check:
1. Python version: python3 --version
2. FFmpeg: ffmpeg -version
3. Module: python3 -c "import faster_whisper"
4. Endpoint: curl http://localhost:3334/api/.../test/check-whisper

# See troubleshooting in:
- WHISPER_UBUNTU.md (Ubuntu)
- WHISPER_SETUP.md (All platforms)
```

### **4. Deploy to production:**
```bash
# See:
- SETUP_UBUNTU.md → "Production Deployment" section
- Use PM2 + Nginx + SSL
```

---

## 🆘 **Getting Help:**

### **Issue Checklist:**

1. ✅ Đã đọc đúng file hướng dẫn cho OS của bạn?
2. ✅ Đã chạy `npm install` và `npm run prisma:generate`?
3. ✅ Đã cài FFmpeg? `ffmpeg -version`
4. ✅ Đã cài faster-whisper? `python3 -c "import faster_whisper"`
5. ✅ Đã cấu hình `.env` đúng?
6. ✅ Đã check logs? `npm run start:client-api:dev`

### **Where to Look:**

| Problem | Check File |
|---------|------------|
| Ubuntu setup | SETUP_UBUNTU.md |
| Whisper on Ubuntu | WHISPER_UBUNTU.md |
| Whisper on macOS | WHISPER_QUICKSTART.md |
| Video upload | VIDEO_UPLOAD_IMPLEMENTATION.md |
| FFmpeg issues | AUDIO_EXTRACTION_SERVICE.md |
| General | AGENTS.md |

---

## 💡 **Tips:**

1. **Đọc file AGENTS.md trước** để hiểu tổng quan dự án
2. **Chọn đúng hướng dẫn** cho OS của bạn (Ubuntu vs macOS)
3. **Follow từng bước** trong hướng dẫn, đừng skip
4. **Test sau mỗi bước** để biết có lỗi sớm
5. **Check logs** nếu có vấn đề

---

## 📊 **Feature Matrix:**

| Feature | Status | Doc |
|---------|--------|-----|
| Backend API | ✅ | AGENTS.md |
| Database (Postgres) | ✅ | SETUP_UBUNTU.md |
| Video Upload | ✅ | VIDEO_UPLOAD_IMPLEMENTATION.md |
| Audio Extraction | ✅ | AUDIO_EXTRACTION_SERVICE.md |
| Auto-Transcription | ✅ | WHISPER_UBUNTU.md |
| YouTube Transcript | ✅ | VIDEO_UPLOAD_IMPLEMENTATION.md |
| Frontend Web | ✅ | AGENTS.md |
| Frontend Mobile | ✅ | AGENTS.md |

---

## 🚀 **Quick Start Commands:**

### **Ubuntu (Full Stack):**
```bash
# 1. Clone & navigate
git clone <repo> && cd english-learning

# 2. Follow SETUP_UBUNTU.md
cat SETUP_UBUNTU.md

# 3. Setup Whisper
cat WHISPER_UBUNTU.md

# 4. Start services
docker compose up -d
npm run start:client-api:dev
```

### **Just Whisper:**
```bash
# Ubuntu
python3 -m venv venv
source venv/bin/activate
pip install faster-whisper

# macOS
python3 -m venv venv
source venv/bin/activate
pip install faster-whisper
```

---

**Questions?** Check the appropriate file above or contact the team.

**Last Updated:** 2025-11-05

