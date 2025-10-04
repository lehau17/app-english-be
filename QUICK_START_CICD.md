# CI/CD Quick Start Card 🚀

## ⚡ 5-Minute Setup

### 1️⃣ GitHub Secrets (2 phút)
Vào **Settings → Secrets → Actions**, thêm:
```
DOCKER_USERNAME = your-dockerhub-username
DOCKER_PASSWORD = your-dockerhub-password
VPS_HOST = 123.45.67.89
VPS_USER = root
VPS_PASSWORD = your-ssh-password
```

### 2️⃣ VPS Setup (2 phút)
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Create .env file
mkdir -p ~/english-learning-backend
cd ~/english-learning-backend
nano .env  # Paste from .env.production.example
```

### 3️⃣ Deploy (1 phút)
```bash
git push origin main  # Tự động deploy!
```

## 📦 What Gets Built

```
┌─────────────────────────────────────┐
│  GitHub Push (main/develop)         │
└────────────┬────────────────────────┘
             │
     ┌───────▼────────┐
     │  Build Images  │
     │  • client-api  │
     │  • worker      │
     │  • notification│
     └───────┬────────┘
             │
     ┌───────▼────────┐
     │ Push to Docker │
     │      Hub       │
     └───────┬────────┘
             │
     ┌───────▼────────┐
     │  SSH to VPS    │
     │  Deploy Apps   │
     └────────────────┘
```

## 🎯 Essential Commands

### On Local Machine
```bash
# Build locally
make build-all

# Push to Docker Hub
make push-all

# View help
make help
```

### On VPS
```bash
# View logs
cd ~/english-learning-backend
docker compose -f docker-compose.prod.yml logs -f

# Check status
docker compose -f docker-compose.prod.yml ps

# Restart
docker compose -f docker-compose.prod.yml restart
```

## 🔍 Check Deployment

```bash
# Health check
curl http://YOUR_VPS_IP:3334/api/health

# View Swagger docs
# Browser: http://YOUR_VPS_IP:3334/api/docs
```

## 🐛 Quick Fixes

### Pipeline Failed?
1. Check GitHub Actions tab for errors
2. Verify all secrets are correct
3. Test SSH: `ssh user@vps-ip`

### App Not Starting?
```bash
ssh user@vps-ip
cd ~/english-learning-backend
docker compose -f docker-compose.prod.yml logs
```

### Out of Space?
```bash
docker system prune -a --volumes
```

## 📱 One-Line Commands

```bash
# Full rebuild and redeploy on VPS
cd ~/english-learning-backend && docker compose -f docker-compose.prod.yml pull && ./deploy.sh

# Quick restart
docker compose -f docker-compose.prod.yml restart

# Emergency stop
docker compose -f docker-compose.prod.yml stop

# View all logs
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

## 🎓 Learn More

- 📖 [Full Guide (English)](./DEPLOYMENT.md)
- 🇻🇳 [Hướng Dẫn Đầy Đủ (Tiếng Việt)](./DEPLOY_GUIDE_VI.md)
- ⚙️ [Makefile Commands](./Makefile)
- 🔄 [GitHub Actions](../.github/workflows/README.md)

## 🆘 Need Help?

Common issues and solutions at: [DEPLOY_GUIDE_VI.md](./DEPLOY_GUIDE_VI.md#-xử-lý-lỗi)

---

**Remember:** First deploy might take 5-10 minutes. Subsequent deploys are faster! ⚡
