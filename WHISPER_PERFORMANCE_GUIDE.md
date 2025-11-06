# Whisper Performance Guide

## ⏱️ Transcription Speed (2-minute video):

| Model | Time | Accuracy | When to Use |
|-------|------|----------|-------------|
| **tiny** | ~15-30s | 80% | ✅ Testing, quick drafts |
| **base** | ~60-90s | 90% | ✅ Production (recommended) |
| **small** | ~3-5min | 93% | High accuracy needed |
| **medium** | ~8-12min | 95% | Best quality |
| **large-v2** | ~15-20min | 96% | Overkill for most cases |

---

## 🚀 Quick Fix for Slow Transcription:

### Option 1: Use "tiny" model (FASTEST)

```bash
# Edit .env
nano /home/hau/KLTN/app-english-be/.env

# Change:
WHISPER_MODEL_SIZE=tiny  # Instead of 'base'

# Restart
pm2 restart main
```

**Result:** 2-min video → ~15-30 seconds transcription (4x faster!)

**Trade-off:** 80% accuracy vs 90% (still decent for most content)

---

## 📊 What's Normal?

### For 2-minute audio:

| Model | Expected Time | What's Happening |
|-------|--------------|------------------|
| tiny | 15-30s | ✅ Fast |
| base | 60-90s | ✅ Normal (you're here) |
| small | 3-5min | ⚠️ Slow but accurate |

**Your case:** 2-min video with "base" model → **60-90s is NORMAL**

---

## 🔍 Debug with Detailed Logs:

After updating the script, you'll see:

```
[WHISPER] ============================================================
[WHISPER] Faster-Whisper Transcription Script
[WHISPER] ============================================================
[WHISPER] Arguments received:
[WHISPER]   Audio path: /tmp/video-processing/xxx.mp3
[WHISPER]   Model size: base
[WHISPER] Starting transcription...
[WHISPER]   Audio file: /tmp/video-processing/xxx.mp3
[WHISPER]   File size: 2.45 MB
[WHISPER]   Model: base
[WHISPER] Loading Whisper model 'base'... (may take 10-30s on first run)
[WHISPER] Model loaded in 5.23s
[WHISPER] Starting transcription... (this may take 1-5 minutes for 2 min audio)
[WHISPER] Transcription started. Language detected: en (probability: 0.98)
[WHISPER] Duration: 125.50s
[WHISPER] Processing segments...
[WHISPER]   Processed 10 segments in 15.3s...
[WHISPER]   Processed 20 segments in 30.8s...
[WHISPER]   Processed 30 segments in 45.2s...
[WHISPER] Transcription completed! Processed 35 segments in 62.45s
[WHISPER] Transcript length: 1523 characters, 287 words
[WHISPER] First 100 chars: Hello everyone, welcome to today's lesson about natural English conversation...
[WHISPER] SUCCESS! Total time: 67.68s
[WHISPER] ============================================================
```

---

## ⚙️ Performance Tuning:

### 1. Use "tiny" for Development

```bash
# In .env
WHISPER_MODEL_SIZE=tiny  # Fast (15-30s for 2min)
```

### 2. Use "base" for Production

```bash
# In .env
WHISPER_MODEL_SIZE=base  # Balanced (60-90s for 2min)
```

### 3. Disable Whisper if Not Needed

```bash
# In .env
ENABLE_WHISPER_TRANSCRIPTION=false
```

User enters transcript manually (instant, 0s processing)

---

## 🎯 Recommendation:

### For Development/Testing:
```bash
WHISPER_MODEL_SIZE=tiny
```

### For Production:
```bash
WHISPER_MODEL_SIZE=base
```

### If users can provide transcript:
```bash
ENABLE_WHISPER_TRANSCRIPTION=false
```

---

## 🔧 Deploy Updated Script:

```bash
# SSH to production
ssh user@haudev.io.vn
cd /home/hau/KLTN/app-english-be

# Pull latest code (with detailed logging)
git pull

# Restart
pm2 restart main

# Test upload video and watch logs
pm2 logs main -f
```

**Now you'll see detailed progress!**

---

## 💡 Why It Takes Time:

1. **Model Loading** (5-30s first time)
   - Downloads model if not cached
   - Loads into memory

2. **Audio Processing** (main time)
   - Splits audio into segments
   - Processes each segment with AI
   - ~0.5-2s per second of audio (depends on model)

3. **Post-processing** (1-2s)
   - Combines segments
   - Formats output

**Example:** 2-min audio with "base" model:
- Load model: 5s
- Process: 120s × 0.5s/s = 60s
- Post-process: 2s
- **Total: ~67s ✅ NORMAL**

---

## 🚨 If It's REALLY Stuck (> 5 minutes):

### Check if Python process is alive:

```bash
# SSH to server
ps aux | grep transcribe.py

# If you see it, it's running (be patient)
# If not, it crashed (check logs)
```

### Check CPU usage:

```bash
top

# Should see python3 using 100% CPU (normal for Whisper)
# If 0% CPU → stuck, restart
```

### Force restart:

```bash
pm2 restart main
```

---

## 📋 Quick Commands:

```bash
# Use fast model (tiny)
echo "WHISPER_MODEL_SIZE=tiny" >> .env && pm2 restart main

# Use balanced model (base) - default
echo "WHISPER_MODEL_SIZE=base" >> .env && pm2 restart main

# Disable transcription
echo "ENABLE_WHISPER_TRANSCRIPTION=false" >> .env && pm2 restart main

# Watch detailed logs
pm2 logs main -f
```

---

**Summary:**
- ✅ 60-90s for 2-min video with "base" is **NORMAL**
- 🚀 Use "tiny" if you need speed (15-30s)
- 📊 Detailed logs now show progress every 5s
- 💡 Can disable Whisper if not needed

**Deploy the updated script to see detailed logs!**

