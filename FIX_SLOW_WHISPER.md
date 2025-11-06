# FIX: Whisper Siêu Chậm (562s cho 152s audio)

## ❌ Problem:

```
Duration: 152.07s (2.5 min video)
Processing: 562.9s for 30 segments (9+ minutes!)
Ratio: ~3.7s per second of audio (VERY SLOW - should be ~0.5s)
```

**Expected:** 2.5 min video → ~60-90s transcription
**Actual:** 2.5 min video → **9+ minutes** (10x slower!)

---

## 🎯 Root Cause:

**CPU too weak for "base" model** → Need lighter model

Possible reasons:
1. Shared CPU instance (low compute)
2. Server overloaded
3. Not enough RAM → swapping to disk
4. Model "base" too heavy for this CPU

---

## ✅ SOLUTION 1: Use "tiny" Model (FASTEST) ⭐ RECOMMENDED

```bash
# SSH to server
cd ~/KLTN/app-english-be

# Stop current processing (if still running)
pm2 restart main

# Download tiny model (75MB - much lighter!)
source venv/bin/activate
python3 -c "from faster_whisper import WhisperModel; print('Downloading tiny...'); WhisperModel('tiny', download_root='./models/whisper'); print('Done!')"

# Update .env
nano .env

# Change or add:
WHISPER_MODEL_SIZE=tiny

# Restart
pm2 restart main
```

**Expected improvement:**
- 152s audio with "tiny" → **~20-30s** (instead of 9 minutes!)
- 10-20x faster!
- Accuracy: 75-80% (still usable for most content)

---

## ✅ SOLUTION 2: Disable Whisper (INSTANT)

```bash
# If you don't need auto-transcription
nano ~/KLTN/app-english-be/.env

# Set:
ENABLE_WHISPER_TRANSCRIPTION=false

# Restart
pm2 restart main
```

**Result:**
- Video upload: 5-10s (no transcription)
- User enters transcript manually
- Still get audio extracted from video

---

## ✅ SOLUTION 3: Check Server Resources

```bash
# Check CPU
lscpu | grep "Model name"
lscpu | grep "CPU(s):"

# Check RAM
free -h

# Check load
top

# Check CPU usage during transcription
htop  # or top, watch python3 process
```

**If you see:**
- CPU < 2 cores → Use "tiny" model
- RAM < 2GB → Use "tiny" or disable
- CPU at 100% constantly → Server overloaded

---

## 📊 Performance Comparison:

| Model | 152s Audio | CPU Usage | RAM | Recommendation |
|-------|-----------|-----------|-----|----------------|
| **tiny** | ~20-30s | 100% CPU | ~500MB | ✅ Use for weak CPU |
| **base** | ~60-90s | 100% CPU | ~1GB | ✅ Normal CPU (4+ cores) |
| **Your case (base)** | 562s+ | 100% CPU | ? | ❌ CPU too weak! |

**Your CPU is ~7-10x slower than expected** → Use "tiny"!

---

## 🚀 Quick Fix Commands:

### Option A: Switch to "tiny" (Fast)

```bash
cd ~/KLTN/app-english-be && \
source venv/bin/activate && \
python3 -c "from faster_whisper import WhisperModel; WhisperModel('tiny', download_root='./models/whisper')" && \
sed -i 's/WHISPER_MODEL_SIZE=base/WHISPER_MODEL_SIZE=tiny/' .env || echo "WHISPER_MODEL_SIZE=tiny" >> .env && \
pm2 restart main && \
echo "✅ Switched to tiny model - test upload now!"
```

**Time to download tiny:** ~30-60s
**Time to transcribe 152s video:** ~20-30s ✅

### Option B: Disable Whisper (Instant)

```bash
cd ~/KLTN/app-english-be && \
sed -i 's/ENABLE_WHISPER_TRANSCRIPTION=true/ENABLE_WHISPER_TRANSCRIPTION=false/' .env || echo "ENABLE_WHISPER_TRANSCRIPTION=false" >> .env && \
pm2 restart main && \
echo "✅ Whisper disabled - upload will be instant!"
```

---

## 🔧 Test After Fix:

```bash
# Watch logs
pm2 logs main -f

# Upload video from web
# Should see:
[WHISPER] Model: tiny  ← Changed!
[WHISPER] Duration: 152.07s
[WHISPER]   Processed 10 segments in 8.3s...  ← Much faster!
[WHISPER]   Processed 20 segments in 16.8s...
[WHISPER]   Processed 30 segments in 25.2s...
[WHISPER] SUCCESS! Total time: 35.68s  ← ~35s instead of 9 minutes!
```

---

## 💡 Why So Slow?

**Model "base" requirements:**
- Recommended: 4+ CPU cores
- Recommended: 4GB RAM
- Processing: ~0.5-1s per second of audio

**Your server seems to have:**
- Weak/shared CPU (1-2 cores?)
- Maybe low RAM → swapping
- Processing: 3.7s per second (7x slower than expected)

**Solution:** Use lighter model ("tiny") or disable auto-transcription

---

## 🎯 Recommended Setup:

### For Your Server (Weak CPU):

```bash
# .env settings
ENABLE_WHISPER_TRANSCRIPTION=true
WHISPER_MODEL_SIZE=tiny  # ← Use tiny instead of base
PYTHON_PATH=venv/bin/python3
```

### For Powerful Server (4+ cores, 8GB RAM):

```bash
# .env settings
ENABLE_WHISPER_TRANSCRIPTION=true
WHISPER_MODEL_SIZE=base  # Can use base
PYTHON_PATH=venv/bin/python3
```

---

## 📋 Action Items:

**Right now - Choose one:**

**Option A: Fast transcription (tiny model)**
```bash
cd ~/KLTN/app-english-be
source venv/bin/activate
python3 -c "from faster_whisper import WhisperModel; WhisperModel('tiny', download_root='./models/whisper')"
echo "WHISPER_MODEL_SIZE=tiny" >> .env
pm2 restart main
```
→ 152s video = ~25-35s transcription ✅

**Option B: Manual transcription (instant)**
```bash
cd ~/KLTN/app-english-be
echo "ENABLE_WHISPER_TRANSCRIPTION=false" >> .env
pm2 restart main
```
→ 152s video = ~5-10s upload, no auto-transcript ✅

---

**My Recommendation:** **Use Option A (tiny model)**
- Still get auto-transcript
- 10x faster than current
- Good enough accuracy for podcast content

**Deploy and test!** 🚀

