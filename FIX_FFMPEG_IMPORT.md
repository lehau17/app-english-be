# Fix FFmpeg Import Error

## ❌ Error:

```
(0 , fluent_ffmpeg_1.default) is not a function
```

**Cause:** Wrong import syntax for CommonJS module `fluent-ffmpeg`

---

## ✅ Fix Applied:

### Changed in `audio-extraction.service.ts`:

```typescript
// ❌ BEFORE (Wrong - ES6 default import)
import ffmpeg from 'fluent-ffmpeg';

// ✅ AFTER (Correct - namespace import)
import * as ffmpeg from 'fluent-ffmpeg';
```

**Why:** `fluent-ffmpeg` is a CommonJS module that doesn't have a default export.
Using `import *` works correctly with TypeScript/NestJS build.

---

## 🔨 Deploy Steps:

```bash
# 1. Git pull latest code
cd /home/hau/KLTN/app-english-be
git pull

# 2. Install dependencies (if needed)
npm install

# 3. Rebuild
npm run build

# 4. Restart
pm2 restart main

# 5. Check logs
pm2 logs main -f
```

---

## ✅ Verify Fix:

### Upload video again from web

**Expected logs:**
```
[UploadService] Uploading file: video.mp4 (22.84MB)
[UploadService] Upload successful: https://static.haudev.io.vn/...
[VideoProcessingService] Step 2/4: Extracting audio with FFmpeg...
[AudioExtractionService] Extracting audio from /tmp/...
[AudioExtractionService] FFmpeg command: ffmpeg -i ...
[AudioExtractionService] Processing: 25.50% done
[AudioExtractionService] Processing: 50.00% done
[AudioExtractionService] Processing: 75.25% done
[AudioExtractionService] Audio extraction completed: /tmp/xxx.mp3
[UploadService] Uploading buffer: xxx.mp3 (5.23MB)
[UploadService] Buffer upload successful: https://static.haudev.io.vn/...
[VideoProcessingService] Video processing completed in 15.23s
```

**Success response:**
```json
{
  "videoUrl": "https://static.haudev.io.vn/.../video.mp4",
  "audioUrl": "https://static.haudev.io.vn/.../audio.mp3",
  "transcript": "...",
  "duration": 120,
  "sizeBytes": 23957299,
  "status": "completed",
  "message": "Video processed in 15.23s"
}
```

---

## 🚨 If Still Fails:

### Option 1: Check FFmpeg installed on server

```bash
# SSH to production
ssh user@haudev.io.vn

# Check ffmpeg
which ffmpeg
ffmpeg -version

# If not installed:
sudo apt update
sudo apt install ffmpeg -y
```

### Option 2: Alternative import (if needed)

If `import * as` still doesn't work, try:

```typescript
import ffmpeg = require('fluent-ffmpeg');
```

---

## 📋 Checklist:

- [x] Fixed import from `import ffmpeg from` → `import * as ffmpeg`
- [ ] Pull latest code
- [ ] npm run build
- [ ] pm2 restart main
- [ ] Test upload video
- [ ] Verify logs show FFmpeg processing
- [ ] Check response has videoUrl + audioUrl

---

**Status:** Fix applied, ready to rebuild
**Next:** Deploy and test

