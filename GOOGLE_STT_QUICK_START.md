# Google Speech-to-Text - Quick Start Guide

## 🎯 Giải pháp cho CPU yếu (1 core @ 2.2GHz)

**Video 3 phút:**
- ❌ Whisper: 15+ phút (CPU 100%)
- ✅ **Google STT: 10-30 giây** (CPU 0%)

---

## ⚡ Setup Nhanh (15 phút):

### 1. Tạo Google Cloud Project (5 phút)

```
1. Vào: https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Project name: "english-learning-app"
4. Click "Create"
5. Chọn project vừa tạo
```

### 2. Enable Speech-to-Text API (2 phút)

```
1. Vào: https://console.cloud.google.com/marketplace/product/google/speech.googleapis.com
2. Click "Enable"
3. Đợi 30 giây
```

### 3. Tạo Service Account (3 phút)

```
1. Vào: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click "Create Service Account"
3. Name: speech-to-text-service
4. Click "Create and Continue"
5. Role: Chọn "Cloud Speech Client" hoặc "Editor"
6. Click "Continue" → "Done"
```

### 4. Download Key (1 phút)

```
1. Click vào service account vừa tạo
2. Tab "Keys"
3. "Add Key" → "Create new key"
4. Chọn "JSON"
5. Click "Create"
6. File JSON sẽ tự động download
```

### 5. Upload Key Lên Server (2 phút)

```bash
# From your laptop
scp ~/Downloads/english-learning-app-xxxxx.json user@haudev.io.vn:/home/hau/

# SSH to server
ssh user@haudev.io.vn
cd ~/KLTN/app-english-be

# Move and rename
mv ~/english-learning-app-xxxxx.json google-credentials.json

# Set permission
chmod 600 google-credentials.json

# Verify
ls -la google-credentials.json
# Should show: -rw------- (600)
```

### 6. Configure .env (2 phút)

```bash
cd ~/KLTN/app-english-be
nano .env

# Add these lines AT THE END:
# ============================================================
# Google Speech-to-Text (RECOMMENDED for weak CPU)
# ============================================================
TRANSCRIPTION_SERVICE=google
GOOGLE_APPLICATION_CREDENTIALS=/home/hau/KLTN/app-english-be/google-credentials.json

# Disable Whisper (CPU too weak)
ENABLE_WHISPER_TRANSCRIPTION=false

# Save: Ctrl+O, Enter, Ctrl+X
```

### 7. Deploy & Test (2 phút)

```bash
# Pull latest code
git pull

# Rebuild
npm run build

# Restart
pm2 restart main

# Watch logs
pm2 logs main -f

# Upload video từ web và xem logs!
```

---

## ✅ Expected Logs:

### On Startup:
```
[GoogleTranscriptionService] Google Speech-to-Text initialized successfully
[GoogleTranscriptionService] Credentials: /home/hau/KLTN/app-english-be/google-credentials.json
```

### On Video Upload (3-min video):
```
[VideoProcessingService] Processing video: video.mp4
[VideoProcessingService] Step 1/4: Uploading video to S3...
[UploadService] Upload successful: https://...
[VideoProcessingService] Step 2/4: Extracting audio with FFmpeg...
[AudioExtractionService] Audio extraction completed: /tmp/xxx.mp3
[VideoProcessingService] Step 3/5: Uploading audio to S3...
[UploadService] Buffer upload successful: https://...
[VideoProcessingService] Step 4/5: Transcribing with Google Speech-to-Text...
[GoogleTranscriptionService] Transcribing with Google STT: /tmp/xxx.mp3
[GoogleTranscriptionService]   File size: 5.23 MB
[GoogleTranscriptionService]   Language: en-US
[GoogleTranscriptionService] Sending to Google Speech-to-Text API...
[GoogleTranscriptionService] Google STT completed in 12.45s: Hello everyone...
[GoogleTranscriptionService]   Confidence: 98.5%
[GoogleTranscriptionService]   Words: 287
[VideoProcessingService] Video processing completed in 25.34s

✅ DONE in 25 seconds! (instead of 15 minutes!)
```

---

## 💰 Cost:

```
Free Tier: 60 minutes/month FREE
After that: $0.024/minute

Examples:
- 20 videos × 3 min = 60 min/month = FREE ✅
- 100 videos × 3 min = 300 min/month = $7.20 (~180,000 VNĐ)
- 500 videos × 3 min = 1,500 min/month = $36 (~900,000 VNĐ)
```

**Rẻ hơn NHIỀU so với upgrade server (VPS 4 cores = $40-80/month)!**

---

## 🚨 Troubleshooting:

### No logs "Google Speech-to-Text initialized"

```bash
# Check credentials file exists
ls -la ~/KLTN/app-english-be/google-credentials.json

# Check .env
cat .env | grep GOOGLE_APPLICATION_CREDENTIALS

# If not found, add again:
echo "GOOGLE_APPLICATION_CREDENTIALS=/home/hau/KLTN/app-english-be/google-credentials.json" >> .env
pm2 restart main
```

### Error: "Permission denied"

```bash
# Fix permission
chmod 600 ~/KLTN/app-english-be/google-credentials.json

# Restart
pm2 restart main
```

### Error: "API not enabled"

1. Vào https://console.cloud.google.com/apis/library
2. Tìm "Cloud Speech-to-Text API"
3. Click "Enable"
4. Đợi 1-2 phút
5. Restart app: `pm2 restart main`

### Still using Whisper instead of Google

```bash
# Make sure TRANSCRIPTION_SERVICE is set
cat .env | grep TRANSCRIPTION_SERVICE

# If not "google", fix it:
sed -i 's/TRANSCRIPTION_SERVICE=.*/TRANSCRIPTION_SERVICE=google/' .env
# Or add:
echo "TRANSCRIPTION_SERVICE=google" >> .env

pm2 restart main
```

---

## 📋 Complete .env Example:

```bash
# ... existing vars ...

# ============================================================
# Transcription Service
# ============================================================
# Options: "google" (fast, cloud) or "whisper" (slow, local) or "disabled"
TRANSCRIPTION_SERVICE=google

# Google Speech-to-Text (RECOMMENDED for weak CPU)
GOOGLE_APPLICATION_CREDENTIALS=/home/hau/KLTN/app-english-be/google-credentials.json

# Whisper (backup - disabled for weak CPU)
ENABLE_WHISPER_TRANSCRIPTION=false
WHISPER_MODEL_SIZE=tiny
PYTHON_PATH=venv/bin/python3
```

---

## ✅ Verification Checklist:

After setup, verify:

- [ ] File google-credentials.json exists with 600 permission
- [ ] .env has TRANSCRIPTION_SERVICE=google
- [ ] .env has GOOGLE_APPLICATION_CREDENTIALS path
- [ ] Logs show "Google Speech-to-Text initialized successfully"
- [ ] Upload 3-min video completes in ~20-30s
- [ ] Response includes transcript field with content
- [ ] No CPU spike on server during transcription

---

## 🎯 Final Test:

```bash
# 1. Check startup logs
pm2 logs main --lines 20 | grep Google

# Expected:
# [GoogleTranscriptionService] Google Speech-to-Text initialized successfully

# 2. Upload video
# 3. Check logs
pm2 logs main -f

# Expected: Done in ~20-30s with transcript!
```

---

**Ready to deploy!** 
**Setup time:** ~15 minutes  
**Processing time:** 10-30s per video (instead of 15 min!)  
**Cost:** FREE for first 60 min/month  

🚀 **MUCH BETTER than Whisper on weak CPU!**

