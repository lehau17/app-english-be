# Fix Nginx 413 Request Entity Too Large

## ❌ Problem:

```
statusCode: 413
body: "413 Request Entity Too Large"
server: nginx/1.18.0 (Ubuntu)
```

**Upload video 22.84MB failed** → Nginx blocking large uploads

---

## ✅ Solution: Increase Nginx upload limit

### Find Nginx config for `static.haudev.io.vn`

```bash
# SSH to production server
ssh user@haudev.io.vn

# Find nginx config
sudo find /etc/nginx -name "*.conf" | xargs grep -l "static.haudev.io.vn"

# Common locations:
/etc/nginx/sites-available/static.haudev.io.vn
/etc/nginx/conf.d/static.conf
```

### Edit Nginx config

```bash
# Edit config
sudo nano /etc/nginx/sites-available/static.haudev.io.vn
```

**Add `client_max_body_size` in server block:**

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name static.haudev.io.vn;

    # ADD THIS LINE - Allow uploads up to 500MB
    client_max_body_size 500M;

    # Existing proxy settings
    location / {
        proxy_pass http://minio:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Also add timeout for large files
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # SSL config...
}
```

**Or if using location block:**

```nginx
location /english-learning-bucket/ {
    client_max_body_size 500M;
    proxy_pass http://minio:9000;
    ...
}
```

### Test & Reload Nginx

```bash
# Test config syntax
sudo nginx -t

# If OK:
# nginx: configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload nginx
sudo systemctl reload nginx

# Or restart
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

---

## 🔍 Verify Fix

### Test upload again:

```bash
# From frontend - upload video
# Should now work for files < 500MB
```

### Check logs:

```bash
# Should see success instead of 413
pm2 logs main

# Expected:
[UploadService] Uploading file: video.mp4 (22.84MB)
[UploadService] Upload successful: https://static.haudev.io.vn/english-learning-bucket/xxx-video.mp4
```

---

## 📋 Common Nginx Upload Limits

```nginx
# Small files only (images)
client_max_body_size 10M;

# Medium files (audio, small videos)
client_max_body_size 100M;

# Large files (HD videos)
client_max_body_size 500M;

# Very large files (4K videos)
client_max_body_size 2G;

# No limit (not recommended)
client_max_body_size 0;
```

---

## 🚨 If you don't have access to Nginx config:

### Option 1: Ask server admin to increase limit

Send them this:
```
Please increase client_max_body_size to 500M for static.haudev.io.vn:

In /etc/nginx/sites-available/static.haudev.io.vn, add:
  client_max_body_size 500M;

Then: sudo nginx -t && sudo systemctl reload nginx
```

### Option 2: Use direct MinIO endpoint (bypass Nginx)

```bash
# Edit .env - use MinIO directly
S3_ENDPOINT=http://minio-server-ip:9000

# Instead of:
S3_ENDPOINT=https://static.haudev.io.vn
```

**⚠️ Note:** Direct MinIO endpoint won't have SSL unless configured separately

---

## 🎯 Why CMS works but video upload doesn't?

1. **CMS uploads smaller files** (images, audio < 10MB)
   - Within default Nginx limit

2. **CMS may use different endpoint**
   - Different Nginx config
   - Direct MinIO access

3. **Video files are larger** (22.84MB)
   - Exceed Nginx limit → 413 error

---

## ✅ After Fix Checklist:

- [ ] Find Nginx config for static.haudev.io.vn
- [ ] Add `client_max_body_size 500M;`
- [ ] Add timeout settings (300s)
- [ ] Test config: `sudo nginx -t`
- [ ] Reload: `sudo systemctl reload nginx`
- [ ] Test upload video from web
- [ ] Check logs show success
- [ ] Verify video URL accessible

---

## 📝 Full Example Nginx Config:

```nginx
server {
    listen 443 ssl http2;
    server_name static.haudev.io.vn;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/static.haudev.io.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/static.haudev.io.vn/privkey.pem;

    # IMPORTANT: Allow large uploads
    client_max_body_size 500M;
    client_body_timeout 300s;

    # Proxy to MinIO
    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for large files
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;

        # Buffer settings
        proxy_request_buffering off;
        proxy_buffering off;
    }

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name static.haudev.io.vn;
    return 301 https://$server_name$request_uri;
}
```

---

**Quick fix command:**
```bash
sudo sed -i '/server_name static.haudev.io.vn/a \    client_max_body_size 500M;' /etc/nginx/sites-available/static.haudev.io.vn && sudo nginx -t && sudo systemctl reload nginx
```

**Status:** Ready to apply
**Priority:** HIGH (blocking video uploads)

