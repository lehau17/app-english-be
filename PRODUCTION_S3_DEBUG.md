# Production S3/MinIO Debug Guide

## ❌ Current Error (Production):

```
BadRequestException: Processing failed: Expected closing tag 'hr' (opened in line 5, col 1) instead of closing tag 'body'
```

**Meaning:** S3/MinIO endpoint returning HTML error page instead of XML/JSON

---

## 🔧 Debug Steps (Production)

### Step 1: Test S3 Connection

**Call test endpoint:**
```bash
# Test S3 connection
curl https://api.haudev.io.vn/api/public/v1/upload/test-s3-connection

# Expected response if OK:
{
  "success": true,
  "endpoint": "http://minio-host:9000",
  "bucket": "english-learning",
  "message": "S3 connection OK. Bucket 'english-learning' exists.",
  "buckets": ["english-learning", "other-bucket"]
}

# If FAILED:
{
  "success": false,
  "endpoint": "...",
  "message": "S3 connection FAILED: ...",
  "error": { ... }
}
```

### Step 2: Check Logs with Better Error Details

Sau khi update code, khi upload video sẽ thấy logs chi tiết:

```bash
# SSH vào production server
cd /home/hau/KLTN/app-english-be

# Check logs
pm2 logs main --lines 100

# Hoặc
docker compose logs -f main
```

**Expected logs:**
```
[UploadService] S3 Configuration initialized:
[UploadService]   - Endpoint: http://minio:9000
[UploadService]   - Bucket: english-learning
[UploadService]   - Region: us-east-1
[UploadService]   - Access Key: minio***

[UploadService] Uploading file: video.mp4 (45.23MB)

# If error:
[UploadService] S3 Upload Error: {
  message: "...",
  code: "...",
  endpoint: "...",
  statusCode: 403 or 500,
  ...
}

[UploadService] Raw S3 Response: {
  statusCode: 403,
  body: "<html>...</html>" <- THIS IS THE HTML ERROR
}
```

### Step 3: Common Issues & Fixes

#### Issue 1: MinIO container not running
```bash
# Check containers
docker compose ps | grep minio

# If down:
docker compose up -d minio

# Check logs
docker compose logs minio

# Should see:
# API: http://172.x.x.x:9000
# Console: http://172.x.x.x:9001
```

#### Issue 2: Wrong S3_ENDPOINT
```bash
# Check production .env
cat .env | grep S3_

# Common mistakes:
S3_ENDPOINT=http://localhost:9000  # ❌ Wrong in Docker
S3_ENDPOINT=http://minio:9000      # ✅ Correct (Docker network)
# hoặc
S3_ENDPOINT=http://IP:9000         # ✅ OK if external

# If production uses domain:
S3_ENDPOINT=https://minio.haudev.io.vn  # ✅ with SSL
```

**Fix:**
```bash
# Edit .env
nano .env

# Change:
S3_ENDPOINT=http://minio:9000  # Docker network name
# hoặc
S3_ENDPOINT=https://s3.haudev.io.vn  # External domain

# Restart
pm2 restart main
# hoặc
docker compose restart main
```

#### Issue 3: Bucket doesn't exist
```bash
# Access MinIO Console
# Production: https://minio.haudev.io.vn:9001
# or http://IP:9001

# Login with credentials from .env:
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# Check if bucket 'english-learning' exists
# If not: Create bucket → name: english-learning
```

#### Issue 4: Network/Firewall issue
```bash
# Test from production server
curl http://minio:9000/minio/health/live

# Expected:
# <html>...</html> with 200 OK

# Or test S3 API:
curl -v http://minio:9000/english-learning/

# If can't connect → firewall or wrong network
```

#### Issue 5: Credentials wrong
```bash
# Verify credentials
cat .env | grep S3_

# Test with MinIO client (mc)
mc alias set myminio http://minio:9000 ACCESS_KEY SECRET_KEY
mc ls myminio

# Should show buckets
# If fails → credentials wrong
```

### Step 4: Verify S3 Config in Code

After update, on startup you'll see:

```
[UploadService] S3 Configuration initialized:
[UploadService]   - Endpoint: http://minio:9000
[UploadService]   - Bucket: english-learning
[UploadService]   - Region: us-east-1
```

**Check if these match your .env:**
```bash
cat .env | grep S3_
```

### Step 5: Test with Small File First

```bash
# Test upload small image first
curl -X POST https://api.haudev.io.vn/api/public/v1/upload \
  -F "file=@test.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected:
{ "url": "http://minio:9000/english-learning/xxxxx-test.jpg" }

# If this works but video fails → video-specific issue
# If this fails → S3 connection issue
```

---

## 🎯 Most Likely Issues (Production):

### 1. ❌ Wrong S3_ENDPOINT
```env
# If using Docker Compose:
S3_ENDPOINT=http://localhost:9000  # ❌ Wrong
S3_ENDPOINT=http://minio:9000      # ✅ Correct (service name)

# If external MinIO:
S3_ENDPOINT=https://minio.haudev.io.vn  # ✅ with domain
```

### 2. ❌ MinIO not accessible from app container
```bash
# From app container, test:
docker exec -it app-container sh
curl http://minio:9000/minio/health/live

# If fails → network issue
```

### 3. ❌ Bucket doesn't exist
- Login MinIO console
- Create bucket: `english-learning`
- Set policy: public or authenticated

### 4. ❌ Credentials mismatch
```bash
# .env credentials must match MinIO
S3_ACCESS_KEY_ID=minioadmin  # or your key
S3_SECRET_ACCESS_KEY=minioadmin  # or your secret
```

---

## ✅ Quick Fix Commands:

```bash
# 1. Check MinIO running
docker compose ps | grep minio

# 2. Test S3 connection endpoint
curl https://api.haudev.io.vn/api/public/v1/upload/test-s3-connection

# 3. Check logs after upload attempt
pm2 logs main --lines 50

# 4. Restart services if .env changed
pm2 restart main
docker compose restart minio

# 5. Test health
curl http://minio:9000/minio/health/live
```

---

## 📋 Checklist:

- [ ] MinIO container running (`docker compose ps`)
- [ ] S3_ENDPOINT correct (minio:9000 or domain)
- [ ] Bucket 'english-learning' exists
- [ ] Credentials correct (ACCESS_KEY, SECRET_ACCESS_KEY)
- [ ] Network accessible (curl test from app container)
- [ ] Test endpoint returns success
- [ ] Logs show correct S3 config on startup
- [ ] Small file upload works

---

## 🔍 After Fix, Expected Behavior:

**On startup:**
```
[UploadService] S3 Configuration initialized:
[UploadService]   - Endpoint: http://minio:9000
[UploadService]   - Bucket: english-learning
[UploadService]   - Region: us-east-1
[UploadService]   - Access Key: minio***
```

**On upload:**
```
[UploadService] Uploading file: video.mp4 (45.23MB)
[VideoProcessingService] Step 1/4: Uploading video to S3...
[UploadService] Upload successful: http://minio:9000/english-learning/xxx-video.mp4
[VideoProcessingService] Video uploaded: http://minio:9000/english-learning/xxx-video.mp4
```

**Response:**
```json
{
  "videoUrl": "http://minio:9000/english-learning/xxx-video.mp4",
  "audioUrl": "http://minio:9000/english-learning/xxx-audio.mp3",
  "transcript": "...",
  "duration": 120,
  "status": "completed"
}
```

---

**Created:** 2025-11-06
**Status:** Ready for production testing
**Action:** Deploy updated code → Check logs → Test connection endpoint

