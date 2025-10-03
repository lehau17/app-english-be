# Deployment Guide

## 🚀 CI/CD Pipeline với GitHub Actions

Dự án sử dụng GitHub Actions để tự động build Docker images, push lên Docker Hub và deploy lên VPS thông qua SSH.

## 📋 Prerequisites

### 1. Docker Hub Account
- Tạo tài khoản tại [Docker Hub](https://hub.docker.com/)
- Tạo repository cho mỗi service:
  - `english-learning-client-api`
  - `english-learning-background-worker`
  - `english-learning-notification`

### 2. VPS Requirements
- Ubuntu 20.04+ hoặc Debian 11+
- Docker và Docker Compose đã cài đặt
- SSH access với password authentication
- Port 22 (SSH) mở
- Port 3334 (API) mở nếu cần truy cập từ bên ngoài

### 3. GitHub Secrets Configuration

Vào repository Settings → Secrets and variables → Actions và thêm các secrets sau:

#### Docker Hub Credentials
```
DOCKER_USERNAME=your-dockerhub-username
DOCKER_PASSWORD=your-dockerhub-password-or-token
```

#### VPS Credentials
```
VPS_HOST=your-vps-ip-or-domain
VPS_USER=your-ssh-username
VPS_PASSWORD=your-ssh-password
VPS_PORT=22  # Optional, default is 22
```

## 🔧 Setup VPS

### 1. Cài đặt Docker và Docker Compose

```bash
# Update package index
sudo apt-get update

# Install dependencies
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Setup repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group (optional)
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker compose version
```

### 2. Tạo .env file trên VPS

```bash
# Connect to VPS
ssh user@your-vps-host

# Create project directory
mkdir -p ~/english-learning-backend
cd ~/english-learning-backend

# Create .env file
nano .env
```

Paste nội dung từ `.env.example` và điều chỉnh cho production:

```env
# Database
DATABASE_URL=postgresql://postgres:your-strong-password@postgres:5432/english_learning
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-strong-password
POSTGRES_DB=english_learning

# JWT
JWT_SECRET=your-very-long-random-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Kafka
KAFKA_BROKERS=redpanda:9092

# SMTP (for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
FROM=your-email@gmail.com

# MinIO/S3
S3_REGION=us-east-1
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=minio
S3_SECRET_ACCESS_KEY=change-this-in-production
S3_BUCKET_NAME=english-learning-bucket
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=change-this-in-production

# API Configuration
CLIENT_API_PORT=3334
API_BASE_URL=http://your-domain.com:3334

# Google Cloud (optional)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=/app/gcloud-key.json

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# AI Speaking
AI_SPEAKING_TTS_USE_HTTP=true
AI_SPEAKING_TTS_HTTP_URL=http://piper-tts:10200
AI_SPEAKING_TTS_VOICE=en_US-lessac-medium
AI_SPEAKING_ASR_WS_URL=ws://vosk-asr:2700
AI_SPEAKING_ASR_AUDIO_FORMAT=pcm16
AI_SPEAKING_ASR_SAMPLE_RATE=16000
AI_SPEAKING_HEALTH_SKIP=false
AI_SPEAKING_HEALTH_TIMEOUT_MS=3000

# Docker Configuration
DOCKER_USERNAME=your-dockerhub-username
IMAGE_TAG=latest
```

## 🔄 Deployment Workflow

### Automatic Deployment

Pipeline tự động chạy khi:
1. Push code lên branch `main` hoặc `develop`
2. Hoặc trigger manual từ GitHub Actions tab

### Workflow Steps

1. **Build Stage**
   - Build 3 Docker images (client-api, background-worker, notification)
   - Push images lên Docker Hub với tags:
     - `<username>/english-learning-<app>:<commit-sha>`
     - `<username>/english-learning-<app>:latest`

2. **Deploy Stage**
   - SSH vào VPS bằng password
   - Copy deployment files (docker-compose.prod.yml, deploy.sh)
   - Pull latest images
   - Stop và remove old containers
   - Run database migrations
   - Start new containers
   - Health check

3. **Notify Stage**
   - Báo kết quả deployment (success/failure)

## 🛠️ Manual Deployment

Nếu muốn deploy thủ công từ VPS:

```bash
# SSH into VPS
ssh user@your-vps-host

# Navigate to project directory
cd ~/english-learning-backend

# Pull latest images
export DOCKER_USERNAME=your-dockerhub-username
export IMAGE_TAG=latest
docker compose -f docker-compose.prod.yml pull

# Deploy
chmod +x deploy.sh
./deploy.sh
```

## 📊 Monitoring

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f client-api
docker compose -f docker-compose.prod.yml logs -f background-worker
docker compose -f docker-compose.prod.yml logs -f notification
```

### Check Service Status

```bash
docker compose -f docker-compose.prod.yml ps
```

### Health Check

```bash
# API health
curl http://localhost:3334/api/health

# Or from outside
curl http://your-vps-ip:3334/api/health
```

### Resource Usage

```bash
docker stats
```

## 🔒 Security Best Practices

1. **Change Default Passwords**: Đổi tất cả passwords trong `.env`
2. **Use Strong JWT Secret**: Tạo secret key dài và random
3. **Firewall Configuration**: Chỉ mở ports cần thiết
4. **Regular Updates**: Cập nhật Docker images thường xuyên
5. **Backup Database**: Setup automated backups cho PostgreSQL
6. **SSL/TLS**: Sử dụng nginx reverse proxy với Let's Encrypt
7. **SSH Key Authentication**: Sau khi test xong, chuyển sang SSH key thay vì password

## 🐛 Troubleshooting

### Services không start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check if ports are in use
sudo netstat -tulpn | grep LISTEN

# Restart services
docker compose -f docker-compose.prod.yml restart
```

### Database connection errors

```bash
# Check database status
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# Check database logs
docker compose -f docker-compose.prod.yml logs postgres

# Restart database
docker compose -f docker-compose.prod.yml restart postgres
```

### Out of disk space

```bash
# Clean up unused Docker resources
docker system prune -a --volumes

# Check disk usage
df -h
du -sh ~/english-learning-backend/*
```

### Pipeline fails

1. Check GitHub Actions logs
2. Verify all secrets are set correctly
3. Test SSH connection manually:
   ```bash
   ssh user@your-vps-host
   ```
4. Verify Docker Hub credentials

## 🔄 Rollback

Nếu deployment có vấn đề:

```bash
# Deploy previous version
export IMAGE_TAG=previous-commit-sha
./deploy.sh

# Or use specific commit
export IMAGE_TAG=abc123def456
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [NestJS Documentation](https://docs.nestjs.com/)

## 📞 Support

Nếu gặp vấn đề, tạo issue trên GitHub repository hoặc liên hệ team.
