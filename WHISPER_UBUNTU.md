# 🐧 Faster-Whisper Setup - Ubuntu

Hướng dẫn nhanh cài đặt Faster-Whisper trên Ubuntu Server/Desktop

---

## ⚡ **Quick Install (3 phút):**

```bash
# 1. Install system dependencies
sudo apt update
sudo apt install -y python3 python3-pip python3-venv ffmpeg

# 2. Navigate to project
cd /path/to/KLTN/english-learning

# 3. Create virtual environment
python3 -m venv venv

# 4. Activate virtual environment
source venv/bin/activate

# 5. Install faster-whisper
pip install faster-whisper

# 6. Verify installation
python3 -c "import faster_whisper; print('✅ Success!')"

# 7. Update .env
echo -e "\n# Whisper Configuration" >> .env
echo "ENABLE_WHISPER_TRANSCRIPTION=true" >> .env
echo "WHISPER_MODEL_SIZE=base" >> .env
echo "PYTHON_PATH=venv/bin/python3" >> .env

# 8. Test
python3 scripts/transcribe.py
```

---

## 📋 **Chi tiết từng bước:**

### **1. Install System Dependencies**

```bash
sudo apt update
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    build-essential
```

**Verify:**
```bash
python3 --version  # Python 3.8+
ffmpeg -version    # FFmpeg 4.x+
```

---

### **2. Setup Virtual Environment**

```bash
cd ~/KLTN/english-learning

# Create venv
python3 -m venv venv

# Activate (phải làm mỗi lần mở terminal mới!)
source venv/bin/activate

# You should see (venv) in prompt:
# (venv) user@ubuntu:~/KLTN/english-learning$
```

---

### **3. Install Faster-Whisper**

```bash
# Make sure venv is activated!
source venv/bin/activate

# Install
pip install faster-whisper

# This will install:
# - faster-whisper
# - ctranslate2
# - huggingface-hub
# - tokenizers
# - onnxruntime
# - And more... (~200MB total)
```

**Wait 2-5 minutes for installation...**

---

### **4. Verify Installation**

```bash
# Test import
python3 -c "import faster_whisper; print('✅ Faster-Whisper installed!')"

# Check version
python3 -c "import faster_whisper; print('Version:', faster_whisper.__version__ if hasattr(faster_whisper, '__version__') else 'OK')"

# Test script
python3 scripts/transcribe.py
# Should show: Usage: python3 transcribe.py <audio_file_path> [model_size]
```

**Expected Output:**
```
✅ Faster-Whisper installed!
Version: 1.2.1
```

---

### **5. Configure Environment**

```bash
cd ~/KLTN/english-learning

# Add to .env
nano .env
```

**Add these lines:**
```bash
# Whisper Transcription
ENABLE_WHISPER_TRANSCRIPTION=true
WHISPER_MODEL_SIZE=base
PYTHON_PATH=venv/bin/python3
```

**Or use command:**
```bash
cat >> .env << 'EOF'

# Whisper Configuration
ENABLE_WHISPER_TRANSCRIPTION=true
WHISPER_MODEL_SIZE=base
PYTHON_PATH=venv/bin/python3
EOF
```

---

### **6. Start Backend**

```bash
cd ~/KLTN/english-learning

# Development mode
npm run start:client-api:dev

# Backend will start on port 3334
```

---

### **7. Test Endpoints**

```bash
# Test FFmpeg
curl http://localhost:3334/api/private/v1/podcasts/test/check-ffmpeg

# Test Whisper
curl http://localhost:3334/api/private/v1/podcasts/test/check-whisper
```

**Expected Response:**
```json
{
  "available": true,
  "message": "Faster-Whisper is installed and ready",
  "modelSize": "base"
}
```

---

## 🧪 **Test with Sample Audio:**

```bash
# Create test audio (1 second beep)
ffmpeg -f lavfi -i "sine=frequency=1000:duration=1" test.wav

# Transcribe (will download model first time)
source venv/bin/activate
python3 scripts/transcribe.py test.wav base
```

**First Run:**
- Downloads model (~150MB)
- Takes 5-10 minutes
- Cached in `models/whisper/`

**Subsequent Runs:**
- Uses cached model
- Very fast!

---

## 🚀 **Usage:**

### **Upload Video with Auto-Transcription:**

1. Go to: `http://localhost:5173/listening-practice/create`
2. Select "Video Podcast"
3. Upload video file
4. Wait for processing (video upload + FFmpeg + Whisper)
5. ✨ **Transcript auto-filled!**

**Processing Time (on typical Ubuntu server):**
- 1 min video: ~20s
- 5 min video: ~90s
- 10 min video: ~3 min

---

## ⚙️ **Model Sizes:**

```bash
# Change model in .env:
WHISPER_MODEL_SIZE=tiny    # Fast, less accurate (75MB)
WHISPER_MODEL_SIZE=base    # RECOMMENDED (150MB)
WHISPER_MODEL_SIZE=small   # Better accuracy (500MB)
WHISPER_MODEL_SIZE=medium  # High accuracy (1.5GB)
WHISPER_MODEL_SIZE=large-v2  # Best accuracy (3GB)
```

**Performance Comparison (CPU):**

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| tiny | 75MB | ⚡⚡⚡ 15s | ⭐⭐⭐ 80% | Testing |
| base | 150MB | ⚡⚡ 60s | ⭐⭐⭐⭐ 90% | **Production** |
| small | 500MB | ⚡ 3min | ⭐⭐⭐⭐ 93% | High quality |
| medium | 1.5GB | 🐌 8min | ⭐⭐⭐⭐⭐ 95% | Best quality |

*Processing time for 5 min video on 2-core CPU*

---

## 🔧 **Troubleshooting:**

### **Problem 1: "No module named 'faster_whisper'"**

```bash
# Activate venv first!
source venv/bin/activate

# Then check
python3 -c "import faster_whisper"

# If still error, reinstall
pip install --upgrade faster-whisper
```

---

### **Problem 2: "No module named 'ctranslate2'"**

```bash
source venv/bin/activate
pip install ctranslate2
```

---

### **Problem 3: FFmpeg not found**

```bash
# Install
sudo apt install -y ffmpeg

# Verify
ffmpeg -version
which ffmpeg  # Should show: /usr/bin/ffmpeg
```

---

### **Problem 4: Slow transcription**

**Solutions:**

1. **Use smaller model:**
   ```bash
   WHISPER_MODEL_SIZE=tiny
   ```

2. **Upgrade CPU:**
   - Faster CPU = faster transcription
   - Whisper is CPU-intensive

3. **Use GPU (CUDA - Advanced):**
   ```bash
   # Only if you have NVIDIA GPU
   pip install faster-whisper[cuda]

   # Update .env
   WHISPER_DEVICE=cuda
   WHISPER_COMPUTE_TYPE=float16
   ```

---

### **Problem 5: Model download fails**

```bash
# Download manually
source venv/bin/activate
python3 << 'EOF'
from faster_whisper import WhisperModel
model = WhisperModel("base", download_root="./models/whisper")
print("✅ Model downloaded!")
EOF
```

---

### **Problem 6: Permission denied**

```bash
# Check venv ownership
ls -la venv/

# Fix permissions
sudo chown -R $USER:$USER venv/
```

---

### **Problem 7: Out of memory**

```bash
# Use smaller model
WHISPER_MODEL_SIZE=tiny

# Or increase swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 🔥 **Performance Optimization:**

### **1. Use SSD for models:**
```bash
# Move models to SSD
mkdir -p /mnt/ssd/whisper-models
ln -s /mnt/ssd/whisper-models ~/KLTN/english-learning/models/whisper
```

### **2. Pre-download all models:**
```bash
source venv/bin/activate
python3 << 'EOF'
from faster_whisper import WhisperModel
for model in ['tiny', 'base', 'small']:
    print(f"Downloading {model}...")
    WhisperModel(model, download_root="./models/whisper")
print("✅ All models downloaded!")
EOF
```

### **3. Monitor resource usage:**
```bash
# Install htop
sudo apt install -y htop

# Monitor while transcribing
htop
```

---

## 📊 **Server Recommendations:**

### **Minimum (Development):**
- CPU: 2 cores
- RAM: 2GB
- Disk: 5GB
- Model: tiny or base

### **Recommended (Production):**
- CPU: 4+ cores
- RAM: 4GB+
- Disk: 10GB SSD
- Model: base or small

### **Optimal (High Volume):**
- CPU: 8+ cores or GPU
- RAM: 8GB+
- Disk: 20GB SSD
- Model: medium or large-v2

---

## 💰 **Cost:**

```
✅ 100% FREE
✅ No API calls
✅ Unlimited transcriptions
✅ No monthly fees
```

**vs OpenAI Whisper API:**
- $0.006/minute
- 1000 videos (5 min each) = $30/month
- With Faster-Whisper = $0

---

## 🎯 **Next Steps:**

1. ✅ Install dependencies
2. ✅ Setup venv & install faster-whisper
3. ✅ Configure .env
4. ✅ Start backend
5. ✅ Test endpoints
6. 🚀 **Upload a video and see magic!**

---

## 📚 **Related Docs:**

- Full Ubuntu Setup: `SETUP_UBUNTU.md`
- Detailed Whisper Guide: `WHISPER_SETUP.md`
- Quick Start: `WHISPER_QUICKSTART.md`

---

**Status:** ✅ Ready for Ubuntu
**Tested:** Ubuntu 20.04, 22.04 LTS
**Cost:** FREE
**Last Updated:** 2025-11-05

