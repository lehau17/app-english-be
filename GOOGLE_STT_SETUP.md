# Google Speech-to-Text Setup Guide

## 🚀 Tại Sao Dùng Google STT Thay Whisper?

| Feature | Whisper (Local) | Google STT (Cloud) |
|---------|----------------|-------------------|
| **Speed** | ❌ 10-15 phút (CPU yếu) | ✅ 10-30 giây |
| **CPU Usage** | ❌ 100% CPU | ✅ 0% (chạy trên cloud) |
| **Accuracy** | 90% | 95-98% |
| **Cost** | Free | $0.024/min (~$0.07 cho 3-min video) |
| **Free Tier** | Unlimited | 60 min/tháng FREE |
| **Setup** | Cài Python, models | Service account key |

**Với CPU 1 core @ 2.2GHz → Google STT là lựa chọn DUY NHẤT!** ✅

---

## 📋 Setup Steps (15 phút):

### Step 1: Tạo Google Cloud Project

1. Vào https://console.cloud.google.com/
2. Tạo project mới: "english-learning-app"
3. Enable billing (có $300 free credit)

### Step 2: Enable Speech-to-Text API

1. Vào https://console.cloud.google.com/apis/library
2. Tìm "Cloud Speech-to-Text API"
3. Click "Enable"

### Step 3: Tạo Service Account

1. Vào: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click "Create Service Account"
3. Name: `speech-to-text-service`
4. Role: `Cloud Speech Client` hoặc `Editor`
5. Click "Done"

### Step 4: Tạo & Download Key

1. Click vào service account vừa tạo
2. Tab "Keys" → "Add Key" → "Create new key"
3. Chọn "JSON" → Create
4. File JSON sẽ được download: `english-learning-app-xxxxx.json`

### Step 5: Upload Key Lên Production Server

```bash
# From local
scp english-learning-app-xxxxx.json user@haudev.io.vn:/home/hau/

# SSH to server
ssh user@haudev.io.vn

# Move to app directory
mv ~/english-learning-app-xxxxx.json ~/KLTN/app-english-be/google-credentials.json

# Set permission
chmod 600 ~/KLTN/app-english-be/google-credentials.json
```

### Step 6: Update .env

```bash
cd ~/KLTN/app-english-be
nano .env

# Add these lines:
TRANSCRIPTION_SERVICE=google
GOOGLE_APPLICATION_CREDENTIALS=/home/hau/KLTN/app-english-be/google-credentials.json

# Optional: Keep Whisper as fallback
ENABLE_WHISPER_TRANSCRIPTION=false
```

### Step 7: Rebuild & Restart

```bash
# Pull latest code
cd ~/KLTN/app-english-be
git pull

# Install dependencies (if needed)
npm install

# Rebuild
npm run build

# Restart
pm2 restart main

# Check logs
pm2 logs main
```

**Should see:**
```
[GoogleTranscriptionService] Google Speech-to-Text initialized successfully
[GoogleTranscriptionService] Credentials: /home/hau/KLTN/app-english-be/google-credentials.json
```

---

## ✅ Test Upload Video:

```bash
# Watch logs
pm2 logs main -f

# Upload video 3 phút từ web
```

**Expected logs:**
```
[VideoProcessingService] Step 1/4: Uploading video to S3...
[VideoProcessingService] Step 2/4: Extracting audio with FFmpeg...
[VideoProcessingService] Step 3/5: Uploading audio to S3...
[VideoProcessingService] Step 4/5: Transcribing with Google Speech-to-Text...
[GoogleTranscriptionService] Transcribing with Google STT: /tmp/xxx.mp3
[GoogleTranscriptionService]   File size: 5.23 MB
[GoogleTranscriptionService]   Language: en-US
[GoogleTranscriptionService] Sending to Google Speech-to-Text API...
[GoogleTranscriptionService] Google STT completed in 12.45s: Hello everyone...  ← FAST!
[GoogleTranscriptionService]   Transcript: Hello everyone, welcome to...
[GoogleTranscriptionService]   Confidence: 98.5%
[GoogleTranscriptionService]   Words: 287
[VideoProcessingService] Video processing completed in 25.34s  ← Total ~25s instead of 15 min!
```

**Response:**
```json
{
  "videoUrl": "https://...",
  "audioUrl": "https://...",
  "transcript": "Hello everyone, welcome to today's lesson about...",
  "duration": 180,
  "status": "completed",
  "message": "Video processed & transcribed in 25.34s"
}
```

---

## 💰 Cost:

### Free Tier (First 60 minutes/month):
- Video 3 phút = 3 minutes = **FREE**
- ~20 videos 3-phút/tháng = **FREE**

### After 60 minutes:
- $0.024/minute
- Video 3 phút = $0.072 (~1,800 VNĐ)
- 100 videos 3-phút/tháng = $7.20 (~180,000 VNĐ)

**Rất rẻ so với việc upgrade server!**

---

## 🔧 Troubleshooting:

### Error: "GOOGLE_APPLICATION_CREDENTIALS not set"

```bash
# Check env
cat ~/KLTN/app-english-be/.env | grep GOOGLE

# Set correct path
echo "GOOGLE_APPLICATION_CREDENTIALS=/home/hau/KLTN/app-english-be/google-credentials.json" >> .env

# Restart
pm2 restart main
```

### Error: "Permission denied"

```bash
# Check file exists
ls -la ~/KLTN/app-english-be/google-credentials.json

# Fix permission
chmod 600 ~/KLTN/app-english-be/google-credentials.json

# Restart
pm2 restart main
```

### Error: "API not enabled"

1. Vào: https://console.cloud.google.com/apis/library
2. Tìm "Cloud Speech-to-Text API"
3. Click "Enable"
4. Wait 1-2 minutes
5. Test lại

### Error: "Quota exceeded"

- Check quota: https://console.cloud.google.com/iam-admin/quotas
- Free tier: 60 min/month
- Nếu hết → enable billing hoặc đợi tháng sau

---

## 📊 Performance Comparison:

### Video 3 phút (180 giây):

| Service | Processing Time | CPU Usage | Cost |
|---------|----------------|-----------|------|
| **Whisper (CPU yếu)** | ~15 phút | 100% | Free |
| **Whisper (CPU tốt)** | ~1-2 phút | 100% | Free |
| **Google STT** | **10-30 giây** | 0% | $0.072 |

**Winner for weak CPU:** Google STT! 🏆

---

## 🎯 .env Configuration:

```bash
# Production - Use Google STT (RECOMMENDED)
TRANSCRIPTION_SERVICE=google
GOOGLE_APPLICATION_CREDENTIALS=/home/hau/KLTN/app-english-be/google-credentials.json

# Disable Whisper (CPU too weak)
ENABLE_WHISPER_TRANSCRIPTION=false
WHISPER_MODEL_SIZE=tiny
PYTHON_PATH=venv/bin/python3

# Or fallback to manual if Google STT fails
# TRANSCRIPTION_SERVICE=disabled
```

---

## 📝 Service Account JSON Example:

```json
{
  "type": "service_account",
  "project_id": "english-learning-app-xxxxx",
  "private_key_id": "xxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "speech-to-text-service@english-learning-app.iam.gserviceaccount.com",
  "client_id": "xxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

**Keep this file secure!** (chmod 600, don't commit to git)

---

## 🔄 Switch Between Services:

### Use Google STT (Fast, Cloud):
```bash
echo "TRANSCRIPTION_SERVICE=google" >> .env
pm2 restart main
```

### Use Whisper (Slow, Local):
```bash
echo "TRANSCRIPTION_SERVICE=whisper" >> .env
echo "ENABLE_WHISPER_TRANSCRIPTION=true" >> .env
pm2 restart main
```

### Disable (Manual):
```bash
echo "TRANSCRIPTION_SERVICE=disabled" >> .env
pm2 restart main
```

---

## 📋 Quick Setup Commands:

```bash
# After downloading service account JSON:

# 1. Upload to server
scp google-credentials.json user@haudev.io.vn:/home/hau/KLTN/app-english-be/

# 2. SSH and configure
ssh user@haudev.io.vn
cd ~/KLTN/app-english-be

# 3. Set permission
chmod 600 google-credentials.json

# 4. Configure .env
cat >> .env << EOF
TRANSCRIPTION_SERVICE=google
GOOGLE_APPLICATION_CREDENTIALS=/home/hau/KLTN/app-english-be/google-credentials.json
ENABLE_WHISPER_TRANSCRIPTION=false
EOF

# 5. Pull code and rebuild
git pull
npm run build

# 6. Restart
pm2 restart main

# 7. Test
pm2 logs main -f
```

---

## ✅ Checklist:

- [ ] Tạo Google Cloud Project
- [ ] Enable Speech-to-Text API
- [ ] Tạo Service Account với role Cloud Speech Client
- [ ] Download service account JSON key
- [ ] Upload key lên server
- [ ] Set GOOGLE_APPLICATION_CREDENTIALS trong .env
- [ ] Set TRANSCRIPTION_SERVICE=google
- [ ] git pull + npm run build
- [ ] pm2 restart main
- [ ] Test upload video 3 phút
- [ ] Verify transcript trong ~10-30s thay vì 15 phút!

---

**Status:** Code ready, waiting for Google credentials  
**Time:** 10-30s per video (instead of 15 minutes!)  
**Cost:** ~$0.07 per 3-min video (60 min/month FREE)  

**MUCH BETTER than local Whisper on weak CPU!** 🚀

