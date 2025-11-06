# Whisper Model Download Guide

## 📥 Cách Model Được Tải:

### Tự động khi chạy lần đầu:

```python
# Trong transcribe.py
model = WhisperModel(
    model_size,              # "tiny", "base", "small", etc.
    device="cpu",
    compute_type="int8",
    download_root="./models/whisper"  # ← Models sẽ lưu ở đây
)
```

**Flow:**
1. Lần đầu chạy → Faster-Whisper tự động download model từ Hugging Face
2. Model được cache vào folder `./models/whisper/`
3. Lần sau → dùng model đã cache (không tải lại)

---

## 📦 Model Sizes & Download:

| Model | Size | Download Time | Location |
|-------|------|---------------|----------|
| **tiny** | ~75MB | 30s-2min | `./models/whisper/tiny.pt` |
| **base** | ~150MB | 1-3min | `./models/whisper/base.pt` |
| **small** | ~500MB | 3-5min | `./models/whisper/small.pt` |
| **medium** | ~1.5GB | 10-15min | `./models/whisper/medium.pt` |
| **large-v2** | ~3GB | 20-30min | `./models/whisper/large-v2.pt` |

**Note:** Download time phụ thuộc vào tốc độ internet của server

---

## 🔍 Kiểm Tra Model Đã Tải Chưa:

```bash
# SSH vào production
ssh user@haudev.io.vn
cd /home/hau/KLTN/app-english-be

# Check folder models
ls -lh models/whisper/

# Expected output (nếu đã tải):
# total 150M
# -rw-r--r-- 1 user user 147M Nov  6 07:00 base.pt
# -rw-r--r-- 1 user user  73M Nov  6 07:00 tiny.pt

# Check size
du -sh models/whisper/
```

**Nếu folder rỗng:** Model chưa được tải, sẽ tải lần đầu transcribe

---

## 🚀 Tải Model Trước (Optional):

### Option 1: Tải thủ công bằng Python

```bash
# SSH to production
cd /home/hau/KLTN/app-english-be
source venv/bin/activate

# Run Python
python3

# In Python console:
>>> from faster_whisper import WhisperModel
>>> print("Downloading 'base' model...")
>>> model = WhisperModel("base", device="cpu", compute_type="int8", download_root="./models/whisper")
>>> print("Downloaded!")
>>> exit()
```

**Time:** 1-3 minutes for "base" model

### Option 2: Test script để tải

```bash
# Create dummy audio for test
ffmpeg -f lavfi -i "sine=frequency=1000:duration=5" -ac 1 test.wav

# Run transcribe (will download model first time)
venv/bin/python3 scripts/transcribe.py test.wav base

# Model will be downloaded and cached
```

---

## 📍 Model Location:

```
/home/hau/KLTN/app-english-be/
├── models/
│   └── whisper/
│       ├── tiny.pt          (75MB)
│       ├── base.pt          (150MB)
│       ├── small.pt         (500MB)
│       ├── medium.pt        (1.5GB)
│       └── large-v2.pt      (3GB)
├── scripts/
│   └── transcribe.py
└── .env
```

---

## ⚠️ First Run Warning:

**Lần đầu transcribe video:**
```
[WHISPER] Loading Whisper model 'base'... (may take 10-30s on first run)
[WHISPER] Downloading model... (this may take 1-3 minutes)
[WHISPER] Model downloaded and cached at ./models/whisper/base.pt
[WHISPER] Model loaded in 125.45s  ← Lâu vì phải download!
```

**Lần sau:**
```
[WHISPER] Loading Whisper model 'base'... (may take 10-30s on first run)
[WHISPER] Model loaded in 5.23s  ← Nhanh vì đã có cache!
```

---

## 💡 Recommendations:

### For Production Setup:

**Step 1: Pre-download model trước khi deploy**

```bash
# Sau khi deploy code lần đầu
cd /home/hau/KLTN/app-english-be
source venv/bin/activate

# Download model
python3 -c "from faster_whisper import WhisperModel; WhisperModel('base', download_root='./models/whisper')"

# Verify
ls -lh models/whisper/
```

**Step 2: Restart app**

```bash
pm2 restart main
```

**Benefit:** User upload video lần đầu không phải đợi download model

---

## 🔄 Upgrade/Change Model:

### Đổi từ "base" sang "tiny" (nhanh hơn):

```bash
# Edit .env
nano .env

# Change:
WHISPER_MODEL_SIZE=tiny  # Model sẽ tự động download lần đầu dùng

# Restart
pm2 restart main

# Test upload → model tiny sẽ được download nếu chưa có
```

### Download nhiều models:

```bash
# Download cả tiny và base
python3 << EOF
from faster_whisper import WhisperModel
print("Downloading tiny...")
WhisperModel("tiny", download_root="./models/whisper")
print("Downloading base...")
WhisperModel("base", download_root="./models/whisper")
print("Done!")
EOF
```

---

## 📊 Disk Space Required:

| Models to Keep | Total Size | Recommendation |
|----------------|------------|----------------|
| tiny only | 75MB | ✅ Testing |
| tiny + base | 225MB | ✅ Flexible (dev + prod) |
| tiny + base + small | 725MB | ⚠️ If need high accuracy |
| All models | 5GB+ | ❌ Overkill |

**Recommendation:** Keep `tiny` (fast dev) + `base` (production)

---

## 🗑️ Delete Old Models:

```bash
# If you want to clean up
cd /home/hau/KLTN/app-english-be

# Remove all models
rm -rf models/whisper/*

# Or remove specific model
rm models/whisper/large-v2.pt

# Next transcribe will re-download
```

---

## 🌐 Download Source:

Models được tải từ **Hugging Face Hub:**
- Repository: `guillaumekln/faster-whisper-*`
- Public, free to use
- No API key needed

**Internet required:** Server cần kết nối internet lần đầu tải model

---

## ✅ Check Model Status:

```bash
# Check if model exists and size
ls -lh models/whisper/base.pt

# Expected:
# -rw-r--r-- 1 user user 147M Nov  6 07:00 base.pt

# If file not found → will download on first use
```

---

## 🚨 Troubleshooting:

### Download failed / timeout:

```bash
# Delete partial download
rm -rf models/whisper/base.pt

# Try download again with better internet
# Or use wget manually:
wget https://huggingface.co/.../base.pt -O models/whisper/base.pt
```

### Permission denied:

```bash
# Fix permissions
chmod -R 755 models/
chown -R $USER:$USER models/
```

### Disk space full:

```bash
# Check disk space
df -h

# Remove unused models
rm models/whisper/large-v2.pt  # Save 3GB
```

---

## 📋 Summary:

1. ✅ **Models tự động download** lần đầu chạy transcribe
2. 📁 **Saved at:** `./models/whisper/`
3. 🚀 **Lần sau:** Dùng cache, không tải lại
4. 💡 **Pre-download:** Nên download trước khi user test
5. 🔄 **Change model:** Chỉ cần đổi `.env` → auto download nếu chưa có

**Quick pre-download command:**
```bash
cd /home/hau/KLTN/app-english-be && \
source venv/bin/activate && \
python3 -c "from faster_whisper import WhisperModel; print('Downloading...'); WhisperModel('base', download_root='./models/whisper'); print('Done!')" && \
ls -lh models/whisper/
```

**Time:** 1-3 minutes → Done! ✅

