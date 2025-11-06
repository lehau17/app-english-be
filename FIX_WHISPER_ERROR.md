# Fix Whisper Transcription Error

## ❌ Error:

```
Command failed: venv/bin/python3 "/home/hau/KLTN/app-english-be/scripts/transcribe.py" "/tmp/video-processing/xxx.mp3" base
```

**Meaning:** Python script failed to run - likely missing dependencies or wrong Python path

---

## 🔍 Possible Causes:

1. ❌ **faster-whisper not installed** in venv
2. ❌ **venv not activated** or doesn't exist
3. ❌ **Python path wrong** in .env
4. ❌ **Script not executable** or missing
5. ❌ **Audio file corrupt** or not accessible

---

## ✅ Solutions:

### Solution 1: Install faster-whisper in Production (RECOMMENDED)

```bash
# SSH to production server
ssh user@haudev.io.vn
cd /home/hau/KLTN/app-english-be

# Option A: Install globally (simple)
sudo pip3 install faster-whisper

# Option B: Install in venv (better isolation)
python3 -m venv venv
source venv/bin/activate
pip install faster-whisper

# Verify installation
python3 -c "import faster_whisper; print('OK')"
# Should print: OK
```

### Solution 2: Disable Whisper Temporarily

**Edit production .env:**

```bash
cd /home/hau/KLTN/app-english-be
nano .env

# Add or change:
ENABLE_WHISPER_TRANSCRIPTION=false

# Save and restart
pm2 restart main
```

**Result:** Video upload will work but **no auto-transcript**. User must enter transcript manually.

---

## 🔧 Debug Steps:

### Step 1: Check if faster-whisper is installed

```bash
# SSH to production
cd /home/hau/KLTN/app-english-be

# Test with the SAME python path that app uses
venv/bin/python3 -c "import faster_whisper; print('OK')"

# If error "No module named 'faster_whisper'":
# → Need to install (see Solution 1)

# If prints "OK":
# → Module is installed, check other issues
```

### Step 2: Check script exists and is executable

```bash
# Check script exists
ls -la /home/hau/KLTN/app-english-be/scripts/transcribe.py

# Make executable if needed
chmod +x /home/hau/KLTN/app-english-be/scripts/transcribe.py

# Test run directly
venv/bin/python3 /home/hau/KLTN/app-english-be/scripts/transcribe.py
# Should show usage: "Usage: python3 transcribe.py <audio_file_path> [model_size]"
```

### Step 3: Test with real audio file

```bash
# Create test audio (or use existing)
cd /home/hau/KLTN/app-english-be

# Test transcription
venv/bin/python3 scripts/transcribe.py /tmp/test.mp3 base

# Expected output: transcript text
# If error: see error message for details
```

### Step 4: Check .env Python path

```bash
cat /home/hau/KLTN/app-english-be/.env | grep PYTHON_PATH

# Should be one of:
PYTHON_PATH=python3           # System python
PYTHON_PATH=venv/bin/python3  # Venv python (if you use venv)
PYTHON_PATH=/usr/bin/python3  # Absolute path

# If using venv, make sure:
# 1. venv exists
# 2. faster-whisper is installed IN that venv
```

---

## 📋 Full Installation Guide:

### For Production (Ubuntu):

```bash
# 1. SSH to server
ssh user@haudev.io.vn
cd /home/hau/KLTN/app-english-be

# 2. Install system dependencies
sudo apt update
sudo apt install -y python3 python3-pip python3-venv

# 3. Create venv (if not exists)
python3 -m venv venv

# 4. Activate venv
source venv/bin/activate

# 5. Install faster-whisper
pip install --upgrade pip
pip install faster-whisper

# 6. Verify
python -c "import faster_whisper; print('✅ Faster-Whisper installed!')"

# 7. Deactivate venv
deactivate

# 8. Update .env
nano .env
# Set:
ENABLE_WHISPER_TRANSCRIPTION=true
WHISPER_MODEL_SIZE=base
PYTHON_PATH=venv/bin/python3

# 9. Restart app
pm2 restart main

# 10. Test upload video
pm2 logs main -f
```

---

## 🎯 Alternative: Use System Python (Simpler)

```bash
# Install globally
sudo pip3 install faster-whisper

# Edit .env
nano .env
# Set:
PYTHON_PATH=python3  # Not venv/bin/python3

# Restart
pm2 restart main
```

**Pros:** Simpler, no venv needed
**Cons:** Global install, less isolation

---

## ⚠️ If You Don't Want Auto-Transcription:

**Just disable it:**

```bash
# In .env
ENABLE_WHISPER_TRANSCRIPTION=false

# Restart
pm2 restart main
```

**Video upload will still work**, but:
- ✅ Video uploaded
- ✅ Audio extracted
- ❌ No auto-transcript (user enters manually)

---

## ✅ Verify Fix:

### After installation, upload video should show:

```
[VideoProcessingService] Step 4/5: Transcribing with Whisper...
[WhisperService] Transcribing: /tmp/xxx.mp3
[WhisperService] Transcription completed in 45.23s: Hello everyone...
```

**Response will include transcript:**

```json
{
  "videoUrl": "https://...",
  "audioUrl": "https://...",
  "transcript": "Hello everyone, welcome to...",  ← AUTO-GENERATED!
  "status": "completed",
  "message": "Video processed & transcribed in 67.34s"
}
```

---

## 🚨 Common Errors & Fixes:

### Error: "No module named 'faster_whisper'"

```bash
# Install it
pip3 install faster-whisper
# or
venv/bin/pip install faster-whisper
```

### Error: "Command failed: venv/bin/python3"

```bash
# Option 1: Use system python
# In .env: PYTHON_PATH=python3

# Option 2: Create venv
python3 -m venv venv
source venv/bin/activate
pip install faster-whisper
```

### Error: "Permission denied"

```bash
# Make script executable
chmod +x scripts/transcribe.py

# Check owner
ls -la scripts/transcribe.py
# If wrong owner:
sudo chown $USER:$USER scripts/transcribe.py
```

### Error: "File not found: /tmp/xxx.mp3"

- Audio extraction failed before Whisper
- Check FFmpeg logs (earlier step)
- Make sure FFmpeg is working

---

## 📊 Model Size Recommendations:

| Use Case | Model | Why |
|----------|-------|-----|
| **Development/Testing** | `tiny` | Fast, 15s for 5min audio |
| **Production (Default)** | `base` | Good balance: 60s for 5min |
| **High Accuracy Needed** | `small` | Better accuracy, slower |
| **Best Quality** | `large-v2` | Best but very slow |

**Set in .env:**
```bash
WHISPER_MODEL_SIZE=base  # Change to tiny/small/medium/large-v2
```

---

## 📝 Quick Fix Checklist:

- [ ] SSH to production server
- [ ] Install faster-whisper: `pip3 install faster-whisper`
- [ ] Verify: `python3 -c "import faster_whisper; print('OK')"`
- [ ] Update .env: `PYTHON_PATH=python3` or `venv/bin/python3`
- [ ] Set: `ENABLE_WHISPER_TRANSCRIPTION=true`
- [ ] Restart: `pm2 restart main`
- [ ] Test upload video
- [ ] Check logs: `pm2 logs main`
- [ ] Verify transcript in response

---

**Quick Install Command:**
```bash
cd /home/hau/KLTN/app-english-be && \
sudo pip3 install faster-whisper && \
python3 -c "import faster_whisper; print('✅ Installed!')" && \
echo "PYTHON_PATH=python3" >> .env && \
echo "ENABLE_WHISPER_TRANSCRIPTION=true" >> .env && \
pm2 restart main && \
pm2 logs main
```

---

**Status:** Ready to fix
**Priority:** Medium (can disable if needed)
**Time:** 5-10 minutes to install

