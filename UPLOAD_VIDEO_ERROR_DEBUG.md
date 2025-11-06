# Upload Video Error - Debug Guide

## ❌ Lỗi hiện tại:

```json
{
  "statusCode": 400,
  "message": "Processing failed: Expected closing tag 'hr' (opened in line 5, col 1) instead of closing tag 'body'.:6:1\n  Deserialization error: to see the raw response, inspect the hidden field {error}.$response on this object.",
  "path": "/api/private/v1/podcasts/upload-video"
}
```

## 🔍 Nguyên nhân:

**S3/MinIO service đang trả về HTML error page thay vì JSON response** ❌

Lỗi "Expected closing tag 'hr'" là HTML parsing error → AWS SDK đang nhận HTML thay vì XML/JSON

## 🎯 Các khả năng:

### 1. MinIO Server không chạy
```bash
# Kiểm tra Docker containers
docker ps | grep minio

# Nếu không có, start lại:
cd english-learning
docker compose up -d minio
```

### 2. S3 Credentials sai hoặc không đủ quyền
Kiểm tra trong `.env`:
```env
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=english-learning
```

**Test connection:**
```bash
# Test MinIO endpoint
curl http://localhost:9000/minio/health/live

# Hoặc truy cập console
open http://localhost:9001
```

### 3. Bucket chưa được tạo
```bash
# Vào MinIO console: http://localhost:9001
# Login: minioadmin / minioadmin
# Tạo bucket: english-learning
```

### 4. Network/Endpoint không đúng

**Nếu deploy production:**
```env
# Đổi từ localhost sang domain thực
S3_ENDPOINT=https://s3.yourdomain.com
# hoặc
S3_ENDPOINT=https://minio.yourdomain.com
```

## 🔧 Fix Steps:

### Step 1: Kiểm tra MinIO đang chạy
```bash
cd /Users/hiteksofftware/Desktop/KLTN/english-learning

# Check containers
docker compose ps

# Nếu MinIO down, start lại
docker compose up -d minio redis postgres redpanda

# Check logs
docker compose logs minio
```

### Step 2: Verify MinIO Console
```bash
# Truy cập console
open http://localhost:9001

# Login:
# Username: minioadmin
# Password: minioadmin
```

### Step 3: Kiểm tra bucket tồn tại
Trong MinIO console:
- Vào **Buckets**
- Xem có bucket `english-learning` không?
- Nếu không: Create new bucket → name: `english-learning`

### Step 4: Test upload thủ công
```bash
# Upload file test
curl -X POST http://localhost:3334/api/public/v1/upload \
  -F "file=@test.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 5: Thêm error handling tốt hơn

Sửa file `upload.service.ts`:

```typescript
async uploadFile(file: Express.Multer.File): Promise<string> {
  try {
    let processedBuffer = file.buffer;
    // ... existing code ...

    const command = new PutObjectCommand({
      Bucket: this.s3BucketName,
      Key: key,
      Body: processedBuffer,
      ContentType: file.mimetype,
    });

    await this.s3Client.send(command);

    return `${this.s3Endpoint}/${this.s3BucketName}/${key}`;
  } catch (error) {
    // ADD THIS ERROR LOGGING
    console.error('S3 Upload Error:', {
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      endpoint: this.s3Endpoint,
      bucket: this.s3BucketName,
    });

    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}
```

### Step 6: Check production environment

Nếu deploy production với domain `api.haudev.io.vn`:

1. **Kiểm tra S3_ENDPOINT trong production .env**:
```env
# Phải là HTTPS nếu production
S3_ENDPOINT=https://minio.haudev.io.vn
# hoặc
S3_ENDPOINT=https://s3.haudev.io.vn
```

2. **Kiểm tra MinIO có accessible từ production server không**:
```bash
# SSH vào production server
curl https://minio.haudev.io.vn/minio/health/live
```

3. **Kiểm tra credentials production**:
```bash
# Trong production server
cat .env | grep S3_
```

## 🐛 Debug Commands:

### Test S3 connection from backend
```typescript
// Tạo test endpoint trong podcast controller
@Get('test/s3-connection')
async testS3Connection() {
  try {
    const command = new ListBucketsCommand({});
    const response = await this.s3Client.send(command);
    return {
      success: true,
      buckets: response.Buckets,
      endpoint: this.s3Endpoint
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      endpoint: this.s3Endpoint
    };
  }
}
```

### Check MinIO logs
```bash
docker compose logs -f minio
```

### Test upload với curl
```bash
# Test MinIO API directly
curl -X PUT http://localhost:9000/english-learning/test.txt \
  -H "Content-Type: text/plain" \
  -H "Authorization: AWS4-HMAC-SHA256 ..." \
  --data "test content"
```

## ✅ Expected Fix:

Sau khi fix, bạn sẽ thấy:
```json
{
  "videoUrl": "http://localhost:9000/english-learning/xxxxx-video.mp4",
  "audioUrl": "http://localhost:9000/english-learning/xxxxx-audio.mp3",
  "transcript": "...",
  "duration": 120,
  "status": "completed"
}
```

## 📝 Checklist:

- [ ] MinIO container đang chạy
- [ ] MinIO console accessible (http://localhost:9001)
- [ ] Bucket `english-learning` đã được tạo
- [ ] S3_ENDPOINT đúng (localhost:9000 for dev, domain cho prod)
- [ ] Credentials đúng (minioadmin/minioadmin cho dev)
- [ ] Test upload file nhỏ trước (ảnh)
- [ ] Kiểm tra logs: `docker compose logs minio`

---

**Most likely issue:** MinIO container không chạy hoặc endpoint sai.

**Quick fix:**
```bash
cd english-learning
docker compose up -d minio
# Wait 5s
docker compose logs minio
# Should see "API: http://..."
```

