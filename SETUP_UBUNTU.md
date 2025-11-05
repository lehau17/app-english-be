# 🐧 Setup Guide - Ubuntu/Linux

Hướng dẫn cài đặt đầy đủ dự án trên Ubuntu Server/Desktop

---

## 📋 **Yêu cầu hệ thống:**

- Ubuntu 20.04 LTS trở lên
- RAM: 4GB+ (8GB khuyến nghị cho Whisper)
- Disk: 10GB+ free space
- User có quyền sudo

---

## 🚀 **Quick Start (Copy & Paste):**

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install dependencies
sudo apt install -y nodejs npm python3 python3-pip python3-venv ffmpeg postgresql redis docker.io

# 3. Clone project (nếu chưa có)
cd ~/
git clone <your-repo-url> KLTN
cd KLTN/english-learning

# 4. Setup Backend
npm install
npm run prisma:generate

# 5. Setup Python & Whisper
python3 -m venv venv
source venv/bin/activate
pip install faster-whisper

# 6. Setup Docker services
docker compose up -d postgres redis minio redpanda

# 7. Configure .env (xem phần dưới)
cp .env.example .env
nano .env

# 8. Run migrations
npm run prisma:migrate

# 9. Start backend
npm run start:client-api:dev
```

---

## 📦 **Chi tiết từng bước:**

### **1. System Update**

```bash
sudo apt update
sudo apt upgrade -y
```

---

### **2. Install Node.js & npm**

#### **Option A: NodeSource (Recommended - Latest)**
```bash
# Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v  # v20.x.x
npm -v   # 10.x.x
```

#### **Option B: Ubuntu Repository (Older)**
```bash
sudo apt install -y nodejs npm

# Upgrade npm
sudo npm install -g npm@latest
```

---

### **3. Install Python 3**

```bash
# Python 3 (usually pre-installed on Ubuntu)
sudo apt install -y python3 python3-pip python3-venv

# Verify
python3 --version  # Python 3.8+
pip3 --version
```

---

### **4. Install FFmpeg**

```bash
# FFmpeg (for audio extraction)
sudo apt install -y ffmpeg

# Verify
ffmpeg -version
```

**Expected Output:**
```
ffmpeg version 4.x.x
```

---

### **5. Install PostgreSQL**

#### **Option A: Docker (Recommended)**
```bash
# Already included in docker-compose.yml
docker compose up -d postgres
```

#### **Option B: Native Installation**
```bash
sudo apt install -y postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database & user
sudo -u postgres psql -c "CREATE DATABASE english_learning;"
sudo -u postgres psql -c "CREATE USER english_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE english_learning TO english_user;"
```

---

### **6. Install Redis**

#### **Option A: Docker (Recommended)**
```bash
docker compose up -d redis
```

#### **Option B: Native Installation**
```bash
sudo apt install -y redis-server

# Start service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test
redis-cli ping  # Should return: PONG
```

---

### **7. Install Docker & Docker Compose**

```bash
# Install Docker
sudo apt install -y docker.io

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (no sudo needed)
sudo usermod -aG docker $USER

# Log out and log back in, then verify
docker --version
docker compose version
```

---

### **8. Clone Project**

```bash
cd ~/
git clone <your-repository-url> KLTN
cd KLTN
```

---

### **9. Setup Backend**

```bash
cd english-learning

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate
```

---

### **10. Setup Python Virtual Environment & Faster-Whisper**

```bash
cd ~/KLTN/english-learning

# Create virtual environment
python3 -m venv venv

# Activate (phải làm mỗi lần mở terminal mới)
source venv/bin/activate

# Install faster-whisper
pip install faster-whisper

# Verify
python3 -c "import faster_whisper; print('✅ Faster-Whisper installed!')"
```

**Output:**
```
✅ Faster-Whisper installed!
```

---

### **11. Start Docker Services**

```bash
cd ~/KLTN/english-learning

# Start all services
docker compose up -d

# Check status
docker compose ps

# Expected output:
# postgres    running    0.0.0.0:5432->5432/tcp
# redis       running    0.0.0.0:6379->6379/tcp
# minio       running    0.0.0.0:9000->9000/tcp
# redpanda    running    0.0.0.0:9092->9092/tcp
```

---

### **12. Configure Environment Variables**

```bash
cd ~/KLTN/english-learning

# Copy example
cp .env.example .env

# Edit
nano .env
```

**Minimum Configuration (.env):**

```bash
# Database
DATABASE_URL="postgresql://english_user:your_password@localhost:5432/english_learning?schema=public"

# API
CLIENT_API_PORT=3334
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka/Redpanda
KAFKA_BROKERS=localhost:9092

# MinIO/S3
S3_ENDPOINT=http://localhost:9000
S3_BUCKET_NAME=english-learning
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_REGION=us-east-1

# Gemini AI (optional, for embeddings)
GEMINI_API_KEY=your_gemini_api_key_here

# FFmpeg & Whisper (NEW!)
ENABLE_WHISPER_TRANSCRIPTION=true
WHISPER_MODEL_SIZE=base
PYTHON_PATH=venv/bin/python3

# SMTP (optional, for emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

**Save:** `Ctrl+X` → `Y` → `Enter`

---

### **13. Run Database Migrations**

```bash
cd ~/KLTN/english-learning

# Push schema to database
npm run prisma:db:push

# Or use migrations
npm run prisma:migrate

# Verify
npm run prisma:studio
# Opens browser at http://localhost:5555
```

---

### **14. Start Backend Server**

```bash
cd ~/KLTN/english-learning

# Development mode (with hot-reload)
npm run start:client-api:dev

# Production mode
npm run build:client-api
npm run start:client-api:prod
```

**Expected Output:**
```
[Nest] INFO [NestFactory] Starting Nest application...
[Nest] INFO [InstanceLoader] AppModule dependencies initialized
[Nest] INFO [NestApplication] Nest application successfully started
[Nest] INFO Listening on port 3334
```

**Access:**
- API: http://localhost:3334/api
- Swagger: http://localhost:3334/api/docs

---

### **15. Setup Frontend**

```bash
# In new terminal
cd ~/KLTN/englishWeb

# Install dependencies
npm install

# Create .env
echo "VITE_API_URL=http://localhost:3334/api" > .env

# Start dev server
npm run dev
```

**Access:** http://localhost:5173

---

## 🧪 **Testing:**

### **1. Check FFmpeg:**
```bash
curl http://localhost:3334/api/private/v1/podcasts/test/check-ffmpeg
```

**Expected:**
```json
{
  "available": true,
  "message": "FFmpeg is installed and ready"
}
```

### **2. Check Whisper:**
```bash
curl http://localhost:3334/api/private/v1/podcasts/test/check-whisper
```

**Expected:**
```json
{
  "available": true,
  "message": "Faster-Whisper is installed and ready",
  "modelSize": "base"
}
```

### **3. Test Database:**
```bash
cd ~/KLTN/english-learning
npm run prisma:studio
```

Opens browser at http://localhost:5555

### **4. Test Video Upload:**
1. Go to: http://localhost:5173/listening-practice/create
2. Select "Video Podcast"
3. Upload a short video
4. Wait for processing
5. ✅ Transcript auto-filled!

---

## 🔧 **Troubleshooting:**

### **Problem 1: Port already in use**

```bash
# Check what's using port 3334
sudo lsof -i :3334

# Kill process
sudo kill -9 <PID>

# Or change port in .env
CLIENT_API_PORT=3335
```

### **Problem 2: Database connection failed**

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Or check Docker container
docker compose ps postgres

# Test connection
psql -h localhost -U english_user -d english_learning
# Password: your_password
```

### **Problem 3: FFmpeg not found**

```bash
# Reinstall
sudo apt install -y ffmpeg

# Check path
which ffmpeg  # Should show: /usr/bin/ffmpeg
```

### **Problem 4: Python module not found**

```bash
# Activate virtual environment first!
source venv/bin/activate

# Then reinstall
pip install faster-whisper

# Verify
python3 -c "import faster_whisper; print('OK')"
```

### **Problem 5: Docker permission denied**

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in
# Or run
newgrp docker

# Test
docker ps
```

### **Problem 6: MinIO bucket not accessible**

```bash
# Access MinIO Console
http://localhost:9001

# Login:
# Username: minioadmin
# Password: minioadmin

# Create bucket: english-learning
```

### **Problem 7: Whisper model download slow**

```bash
# First transcription downloads model (~150MB)
# Be patient, can take 5-10 minutes

# Check download progress
ls -lh ~/KLTN/english-learning/models/whisper/

# Pre-download model manually:
cd ~/KLTN/english-learning
source venv/bin/activate
python3 -c "from faster_whisper import WhisperModel; WhisperModel('base')"
```

---

## 🚀 **Production Deployment:**

### **1. Use PM2 for process management:**

```bash
# Install PM2
sudo npm install -g pm2

# Start backend
cd ~/KLTN/english-learning
pm2 start npm --name "english-api" -- run start:client-api:prod

# Start frontend (build first)
cd ~/KLTN/englishWeb
npm run build
pm2 start npm --name "english-web" -- run preview

# Save PM2 config
pm2 save

# Auto-start on boot
pm2 startup
```

### **2. Setup Nginx reverse proxy:**

```bash
# Install Nginx
sudo apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/english-learning
```

**Config:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3334;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 500M;  # For video uploads
    }
}
```

**Enable:**
```bash
sudo ln -s /etc/nginx/sites-available/english-learning /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### **3. Setup SSL (Let's Encrypt):**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 📊 **System Requirements (Production):**

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4GB | 8GB+ |
| Disk | 20GB | 50GB+ SSD |
| Network | 10 Mbps | 100 Mbps+ |
| OS | Ubuntu 20.04 | Ubuntu 22.04 LTS |

---

## 🔐 **Security Checklist:**

```bash
# 1. Change default passwords in .env
JWT_SECRET=<random-256-bit-string>
DATABASE_URL=postgresql://user:<strong-password>@localhost/db

# 2. Setup firewall
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable

# 3. Disable root SSH
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd

# 4. Keep system updated
sudo apt update && sudo apt upgrade -y

# 5. Setup fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
```

---

## 📚 **Useful Commands:**

```bash
# Check logs
pm2 logs english-api
pm2 logs english-web

# Restart services
pm2 restart english-api
docker compose restart

# Monitor resources
htop
docker stats

# Database backup
pg_dump -U english_user english_learning > backup.sql

# Database restore
psql -U english_user english_learning < backup.sql
```

---

## 🆘 **Support:**

- Documentation: `AGENTS.md`, `WHISPER_SETUP.md`
- Issues: GitHub Issues
- Contact: your-email@domain.com

---

**Last Updated:** 2025-11-05
**Tested On:** Ubuntu 22.04 LTS, Ubuntu 20.04 LTS
**Status:** ✅ Production Ready

