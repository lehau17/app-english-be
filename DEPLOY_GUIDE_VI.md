# Hướng Dẫn Deploy CI/CD - Tiếng Việt

## 🎯 Tổng Quan

Pipeline CI/CD tự động:
1. ✅ Build Docker images cho 3 ứng dụng
2. ✅ Push images lên Docker Hub
3. ✅ SSH vào VPS bằng mật khẩu
4. ✅ Deploy tự động trên VPS

## 🚀 Cài Đặt Nhanh

### Bước 1: Tạo Tài Khoản Docker Hub

1. Đăng ký tại [Docker Hub](https://hub.docker.com/)
2. Tạo 3 repositories công khai:
   - `english-learning-client-api`
   - `english-learning-background-worker`
   - `english-learning-notification`
3. Lấy username và password (hoặc access token)

### Bước 2: Cấu Hình GitHub Secrets

Vào **Settings → Secrets and variables → Actions** của repository và thêm:

#### Thông Tin Docker Hub
```
DOCKER_USERNAME = tên-username-dockerhub
DOCKER_PASSWORD = mật-khẩu-hoặc-token
```

#### Thông Tin VPS
```
VPS_HOST = ip-hoac-domain-cua-vps (ví dụ: 123.45.67.89)
VPS_USER = tên-user-ssh (ví dụ: root hoặc ubuntu)
VPS_PASSWORD = mật-khẩu-ssh
VPS_PORT = 22 (tùy chọn, mặc định là 22)
```

### Bước 3: Cài Đặt Docker Trên VPS

SSH vào VPS và chạy các lệnh sau:

```bash
# Cập nhật hệ thống
sudo apt-get update

# Cài đặt Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Cài đặt Docker Compose
sudo apt-get install -y docker-compose-plugin

# Thêm user vào nhóm docker (tùy chọn)
sudo usermod -aG docker $USER

# Kiểm tra cài đặt
docker --version
docker compose version
```

### Bước 4: Tạo File .env Trên VPS

```bash
# SSH vào VPS
ssh user@ip-vps

# Tạo thư mục dự án
mkdir -p ~/english-learning-backend
cd ~/english-learning-backend

# Tạo file .env
nano .env
```

Paste nội dung sau và chỉnh sửa theo môi trường của bạn:

```env
# Database - ĐỔI MẬT KHẨU
DATABASE_URL=postgresql://postgres:mat-khau-manh-tai-day@postgres:5432/english_learning
POSTGRES_USER=postgres
POSTGRES_PASSWORD=mat-khau-manh-tai-day
POSTGRES_DB=english_learning

# JWT - ĐỔI SECRET KEY
JWT_SECRET=chuoi-ngau-nhien-rat-dai-va-bao-mat
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Kafka
KAFKA_BROKERS=redpanda:9092

# Email - CẤU HÌNH EMAIL CỦA BẠN
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
FROM=email-cua-ban@gmail.com

# MinIO/S3 - ĐỔI MẬT KHẨU
S3_REGION=us-east-1
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=minio
S3_SECRET_ACCESS_KEY=mat-khau-minio-manh
S3_BUCKET_NAME=english-learning-bucket
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=mat-khau-minio-manh

# API
CLIENT_API_PORT=3334
API_BASE_URL=http://domain-hoac-ip-cua-ban.com:3334

# Google Cloud (tùy chọn)
GOOGLE_CLOUD_PROJECT_ID=project-id-cua-ban
GEMINI_API_KEY=api-key-gemini

# AI Speaking
AI_SPEAKING_TTS_USE_HTTP=true
AI_SPEAKING_TTS_HTTP_URL=http://piper-tts:10200
AI_SPEAKING_TTS_VOICE=en_US-lessac-medium
AI_SPEAKING_ASR_WS_URL=ws://vosk-asr:2700
AI_SPEAKING_ASR_AUDIO_FORMAT=pcm16
AI_SPEAKING_ASR_SAMPLE_RATE=16000

# Docker
DOCKER_USERNAME=username-dockerhub-cua-ban
IMAGE_TAG=latest
```

Lưu file (Ctrl+X, Y, Enter)

### Bước 5: Deploy Tự Động

Sau khi hoàn thành các bước trên:

1. **Push code lên GitHub:**
   ```bash
   git add .
   git commit -m "setup: configure CI/CD"
   git push origin main
   ```

2. **Pipeline sẽ tự động chạy:**
   - Vào tab **Actions** trên GitHub để xem tiến trình
   - Pipeline sẽ:
     - Build 3 Docker images
     - Push lên Docker Hub
     - SSH vào VPS
     - Deploy ứng dụng

3. **Kiểm tra trên VPS:**
   ```bash
   ssh user@ip-vps
   cd ~/english-learning-backend
   docker compose -f docker-compose.prod.yml ps
   ```

## 🔍 Kiểm Tra Hoạt Động

### Xem Logs
```bash
# Tất cả services
docker compose -f docker-compose.prod.yml logs -f

# Service cụ thể
docker compose -f docker-compose.prod.yml logs -f client-api
```

### Kiểm Tra API
```bash
curl http://localhost:3334/api/health
```

Hoặc truy cập từ trình duyệt:
- API Docs: `http://ip-vps:3334/api/docs`
- Health Check: `http://ip-vps:3334/api/health`

### Kiểm Tra Containers
```bash
docker ps
docker stats
```

## 🔄 Deploy Thủ Công

Nếu muốn deploy thủ công mà không qua GitHub Actions:

```bash
# SSH vào VPS
ssh user@ip-vps

# Đi đến thư mục dự án
cd ~/english-learning-backend

# Set biến môi trường
export DOCKER_USERNAME=username-cua-ban
export IMAGE_TAG=latest

# Pull images mới nhất
docker compose -f docker-compose.prod.yml pull

# Chạy script deploy
chmod +x deploy.sh
./deploy.sh
```

## 🛑 Dừng Ứng Dụng

```bash
docker compose -f docker-compose.prod.yml stop
```

## 🗑️ Xóa Containers

```bash
docker compose -f docker-compose.prod.yml down
```

## 🔄 Cập Nhật Ứng Dụng

Mỗi lần push code mới lên GitHub, pipeline sẽ tự động:
1. Build images mới
2. Push lên Docker Hub
3. Deploy trên VPS

Hoặc trigger thủ công:
- Vào tab **Actions** trên GitHub
- Chọn workflow "Build and Deploy to VPS"
- Click **Run workflow**

## ❗ Xử Lý Lỗi

### Lỗi SSH Connection
```bash
# Kiểm tra SSH thủ công
ssh -p 22 user@ip-vps

# Kiểm tra tường lửa
sudo ufw status
sudo ufw allow 22
```

### Lỗi Docker Permission
```bash
# Thêm user vào nhóm docker
sudo usermod -aG docker $USER
# Logout và login lại
```

### Lỗi Out of Memory
```bash
# Kiểm tra RAM
free -h

# Tăng swap space nếu cần
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Lỗi Port Đã Được Sử Dụng
```bash
# Kiểm tra port nào đang sử dụng
sudo netstat -tulpn | grep LISTEN

# Dừng service đang chiếm port
sudo systemctl stop <service-name>
```

### Container Không Start
```bash
# Xem logs chi tiết
docker compose -f docker-compose.prod.yml logs <service-name>

# Restart service
docker compose -f docker-compose.prod.yml restart <service-name>
```

## 🔒 Bảo Mật

### Checklist Bảo Mật
- [ ] Đổi tất cả passwords mặc định trong .env
- [ ] Sử dụng JWT secret key dài và phức tạp
- [ ] Cấu hình firewall (ufw) chỉ mở ports cần thiết
- [ ] Sử dụng SSL/TLS với Nginx reverse proxy
- [ ] Định kỳ cập nhật Docker images
- [ ] Backup database thường xuyên
- [ ] Sau khi test, chuyển sang SSH key thay vì password

### Cài Đặt UFW (Firewall)
```bash
# Cài đặt UFW
sudo apt-get install ufw

# Mở ports cần thiết
sudo ufw allow 22     # SSH
sudo ufw allow 3334   # API
sudo ufw allow 80     # HTTP (nếu dùng nginx)
sudo ufw allow 443    # HTTPS (nếu dùng nginx)

# Enable firewall
sudo ufw enable

# Kiểm tra
sudo ufw status
```

## 📊 Monitoring

### Setup Monitoring Cơ Bản
```bash
# Cài đặt htop
sudo apt-get install htop

# Monitor resources
htop

# Docker stats
docker stats

# Disk usage
df -h
du -sh ~/english-learning-backend/*
```

## 💾 Backup

### Backup Database
```bash
# Backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres english_learning > backup.sql

# Restore
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres english_learning
```

## 🆘 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra logs: `docker compose logs`
2. Kiểm tra GitHub Actions logs
3. Đọc [DEPLOYMENT.md](./DEPLOYMENT.md) chi tiết hơn
4. Tạo issue trên GitHub repository

## 📚 Tài Liệu Liên Quan

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Hướng dẫn chi tiết bằng tiếng Anh
- [README.md](./README.md) - Tổng quan dự án
- [.env.production.example](./.env.production.example) - Ví dụ file .env production

---

**Chúc deploy thành công! 🎉**
