# ⚡ Faster-Whisper Quick Start

## 🚀 **3 bước Setup (5 phút):**

### **1. Install Faster-Whisper**
```bash
pip install faster-whisper

# Verify
python3 -c "import faster_whisper; print('✅ Installed!')"
```

### **2. Update .env**
```bash
# Thêm vào english-learning/.env
ENABLE_WHISPER_TRANSCRIPTION=true
WHISPER_MODEL_SIZE=base
```

### **3. Test**
```bash
# Start backend
cd english-learning
npm run start:client-api:dev

# Check Whisper
curl http://localhost:3334/api/private/v1/podcasts/test/check-whisper
```

**Expected:**
```json
{
  "available": true,
  "message": "Faster-Whisper is installed and ready",
  "modelSize": "base"
}
```

---

## ✅ **Done! Giờ upload video sẽ tự động transcribe!**

**Test:**
1. Vào: `http://localhost:5173/listening-practice/create`
2. Chọn "Video Podcast"
3. Upload video ngắn (1-2 phút)
4. Đợi ~30-90s
5. ✨ **Transcript tự động điền vào!**

---

## ⚙️ **Model Sizes:**

```bash
# Fast but less accurate (~15s cho 5 phút video)
WHISPER_MODEL_SIZE=tiny

# RECOMMENDED: Best balance (~60s cho 5 phút)
WHISPER_MODEL_SIZE=base

# High accuracy (~3 phút cho 5 phút video)
WHISPER_MODEL_SIZE=small
```

---

## 🐛 **Troubleshooting:**

### **Error: "No module named 'faster_whisper'"**
```bash
pip3 install faster-whisper
```

### **Error: "No module named 'ctranslate2'"**
```bash
pip3 install ctranslate2
```

### **Model download chậm**
```
Lần đầu chạy sẽ download model (~150MB)
Kiên nhẫn đợi 5-10 phút
```

---

## 📚 **Chi tiết hơn:**
- Xem file: `WHISPER_SETUP.md`
- Hoặc: `VIDEO_UPLOAD_IMPLEMENTATION.md`

---

**FREE ✅ | Offline ✅ | Chính xác 95% ✅**

