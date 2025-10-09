# CI/CD Deployment Guide

## 📁 Project Structure

```
english-learning/
├── Dockerfile                          # Client API service
├── Dockerfile.background-worker        # Background worker service
├── Dockerfile.notification             # Notification service
├── docker-compose.prod.yml             # Production compose file
├── deploy.sh                           # Deployment script
├── apps/
│   ├── background-worker/
│   │   └── src/
│   ├── notification/
│   │   └── src/
│   └── client-api/
│       └── src/
└── .github/
    └── workflows/
        └── deploy.yml                  # GitHub Actions workflow
```

## 🚀 Services Overview

### 1. **client-api** (Port 3334)
- Main REST API
- Handles authentication, courses, classrooms, etc.
- Swagger docs at `/api/docs`

### 2. **background-worker** (Port 3002)
- Cron jobs and scheduled tasks
- Neo4j sync via Kafka
- Embedding reindexing
- Auto status updates

### 3. **notification** (Port 3003)
- Email notifications
- Kafka consumer for notification events
- SMTP integration

## 🔧 Setup Requirements

### 1. GitHub Secrets

Configure these secrets in GitHub repository settings:

| Secret | Description | Example |
|--------|-------------|---------|
| `SSH_PRIVATE_KEY` | SSH private key for VPS access | `-----BEGIN OPENSSH...` |
| `VPS_HOST` | VPS IP address or domain | `123.45.67.89` |
| `VPS_USER` | SSH username | `root` or `ubuntu` |
| `VPS_PORT` | SSH port (default: 22) | `22` |
| `DOCKER_USERNAME` | Docker Hub username | `yourusername` |
| `DOCKER_PASSWORD` | Docker Hub access token | `dckr_pat_xxx` |

### 2. VPS Requirements

**System Requirements:**
- Ubuntu 20.04+ or Debian 11+
- 4GB+ RAM recommended
- 40GB+ disk space
- Docker & Docker Compose installed

**Install Docker:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. Environment Variables on VPS

Create `.env` file at `~/english-learning-backend/.env`:

```env
# Docker
DOCKER_USERNAME=yourusername
IMAGE_TAG=latest

# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/english_learning
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=english_learning
POSTGRES_PORT=5432

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Kafka (Redpanda)
KAFKA_BROKERS=redpanda:9092

# Redis
REDIS_PORT=6379

# S3 (MinIO)
S3_REGION=us-east-1
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=minio
S3_SECRET_ACCESS_KEY=minio123
S3_BUCKET_NAME=english-learning-bucket
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=minio123
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001

# API
CLIENT_API_PORT=3334
API_BASE_URL=http://your-domain.com

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM=noreply@your-domain.com

# Google Cloud (Optional)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=/path/to/key.json

# AI Services
GEMINI_API_KEY=your_gemini_api_key

# AI Speaking (Optional)
AI_SPEAKING_TTS_USE_HTTP=true
AI_SPEAKING_TTS_HTTP_URL=http://piper-tts:10200
AI_SPEAKING_TTS_VOICE=en_US-lessac-medium
AI_SPEAKING_ASR_WS_URL=ws://vosk-asr:2700
AI_SPEAKING_ASR_AUDIO_FORMAT=pcm16
AI_SPEAKING_ASR_SAMPLE_RATE=16000
AI_SPEAKING_HEALTH_SKIP=false
AI_SPEAKING_HEALTH_TIMEOUT_MS=3000

# Ports
PIPER_PORT=10200
VOSK_PORT=2700
```

## 🔄 Deployment Workflow

### Automatic Deployment

**Trigger**: Push to `main` or `develop` branch

```bash
git add .
git commit -m "feat: new feature"
git push origin main
```

**Process**:
1. 🏗️ **Build** - Builds 3 Docker images in parallel
2. 📤 **Push** - Pushes images to Docker Hub
3. 🚀 **Deploy** - SSH to VPS and runs deployment
4. 🔍 **Health Check** - Verifies services are running

### Manual Deployment

**Via GitHub Actions:**
1. Go to **Actions** tab
2. Select **Build and Deploy to VPS**
3. Click **Run workflow**
4. Choose environment (production/staging)
5. Click **Run workflow** button

**Via SSH (manual):**
```bash
# SSH into VPS
ssh user@your-vps-ip

# Navigate to project directory
cd ~/english-learning-backend

# Pull latest images
export DOCKER_USERNAME=yourusername
export IMAGE_TAG=latest
docker compose -f docker-compose.prod.yml pull

# Restart services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

## 📊 Monitoring

### Check Service Status

```bash
# SSH into VPS
ssh user@your-vps-ip
cd ~/english-learning-backend

# List running containers
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Check specific service logs
docker compose -f docker-compose.prod.yml logs -f client-api
docker compose -f docker-compose.prod.yml logs -f background-worker
docker compose -f docker-compose.prod.yml logs -f notification
```

### Health Checks

Each service has health checks:

```bash
# Client API health
curl http://localhost:3334/api/health

# Background Worker health (if exposed)
curl http://localhost:3002/health

# Notification health (if exposed)
curl http://localhost:3003/health
```

### Service Endpoints

- **API**: `http://your-vps-ip:3334/api`
- **Swagger**: `http://your-vps-ip:3334/api/docs`
- **MinIO Console**: `http://your-vps-ip:9001`
- **Redpanda Console**: `http://your-vps-ip:8000` (if enabled)

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs service-name

# Check container status
docker ps -a

# Restart specific service
docker compose -f docker-compose.prod.yml restart service-name

# Full restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Database Issues

```bash
# Check PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d english_learning -c "SELECT 1;"

# Run migrations
docker compose -f docker-compose.prod.yml exec client-api npm run prisma:migrate

# View database
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d english_learning
```

### Kafka/Redpanda Issues

```bash
# Check Redpanda status
docker compose -f docker-compose.prod.yml exec redpanda rpk cluster info

# List topics
docker compose -f docker-compose.prod.yml exec redpanda rpk topic list

# View topic messages
docker compose -f docker-compose.prod.yml exec redpanda rpk topic consume notifications
```

### Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a --volumes

# Remove old images
docker images | grep english-learning | grep -v latest | awk '{print $3}' | xargs docker rmi
```

## 🔐 Security Checklist

- [ ] SSH key authentication enabled
- [ ] Password authentication disabled
- [ ] Firewall configured (ufw/iptables)
- [ ] Only necessary ports exposed
- [ ] Strong passwords for database and services
- [ ] JWT secret is secure (min 32 chars)
- [ ] SSL/TLS certificates configured (if using domain)
- [ ] Environment variables not committed to repo
- [ ] Docker images scanned for vulnerabilities
- [ ] Regular backups configured

### Firewall Setup

```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow API
sudo ufw allow 3334/tcp

# Allow HTTP/HTTPS (if using Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

## 📦 Backup & Restore

### Backup Database

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres english_learning > backup_$(date +%Y%m%d).sql

# Backup with compression
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres english_learning | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore Database

```bash
# Restore from backup
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres english_learning < backup_20250109.sql

# Restore from compressed backup
gunzip < backup_20250109.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres english_learning
```

## 🔄 Rolling Updates

For zero-downtime deployments:

```bash
# Scale up
docker compose -f docker-compose.prod.yml up -d --scale client-api=2

# Wait for new container to be healthy
sleep 30

# Scale down old container
docker compose -f docker-compose.prod.yml up -d --scale client-api=1
```

## 📈 Performance Optimization

### Increase Resource Limits

Edit `docker-compose.prod.yml`:

```yaml
services:
  client-api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Enable Build Cache

Already configured in workflow:
```yaml
cache-from: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/english-learning-${{ matrix.app }}:buildcache
cache-to: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/english-learning-${{ matrix.app }}:buildcache,mode=max
```

## 📚 Related Documentation

- [SSH Key Setup Guide](./SSH_KEY_SETUP.md)
- [Docker Compose Production](../docker-compose.prod.yml)
- [Deployment Script](../deploy.sh)
- [GitHub Actions Workflow](../.github/workflows/deploy.yml)

## 🆘 Support & Contact

If you encounter issues:

1. Check GitHub Actions logs
2. Review VPS service logs
3. Verify environment variables
4. Check firewall rules
5. Ensure sufficient disk space
6. Review security group/firewall settings

---

**Last Updated**: January 2025
