# SSH Key Setup Guide for CI/CD

This guide explains how to set up SSH key authentication for CI/CD deployment instead of using passwords.

## 🔑 Why SSH Keys?

- **More Secure**: Keys are much harder to brute-force than passwords
- **No Password Exposure**: Passwords don't need to be stored or transmitted
- **Revocable**: You can revoke a key without changing your password
- **GitHub Best Practice**: Recommended by GitHub for automated deployments

## 📋 Prerequisites

- Access to your VPS server
- GitHub repository with admin access
- Basic knowledge of SSH

## 🛠️ Setup Steps

### 1. Generate SSH Key Pair (on your local machine)

```bash
# Generate a new SSH key (without passphrase for automation)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# This creates two files:
# - ~/.ssh/github_actions_deploy (private key)
# - ~/.ssh/github_actions_deploy.pub (public key)
```

**Alternative (RSA key)**:
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""
```

### 2. Copy Public Key to VPS

```bash
# Replace with your VPS details
VPS_USER="your_username"
VPS_HOST="your_vps_ip"
VPS_PORT="22"  # or your custom SSH port

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub -p $VPS_PORT $VPS_USER@$VPS_HOST
```

**Manual method** (if ssh-copy-id is not available):
```bash
# Display public key
cat ~/.ssh/github_actions_deploy.pub

# SSH into VPS and add it manually
ssh -p $VPS_PORT $VPS_USER@$VPS_HOST
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

### 3. Test SSH Key Authentication

```bash
# Test connection using the new key
ssh -i ~/.ssh/github_actions_deploy -p $VPS_PORT $VPS_USER@$VPS_HOST

# If successful, you should connect without password prompt
```

### 4. Add SSH Private Key to GitHub Secrets

#### Get Private Key Content:
```bash
# Display private key
cat ~/.ssh/github_actions_deploy

# Copy the ENTIRE output including:
# -----BEGIN OPENSSH PRIVATE KEY-----
# ... (all the lines)
# -----END OPENSSH PRIVATE KEY-----
```

#### Add to GitHub:
1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `SSH_PRIVATE_KEY` | *Full private key content* | Private key from step 4 |
| `VPS_HOST` | `your_vps_ip` | VPS IP address or domain |
| `VPS_USER` | `your_username` | SSH username |
| `VPS_PORT` | `22` | SSH port (22 is default) |
| `DOCKER_USERNAME` | `your_dockerhub_username` | Docker Hub username |
| `DOCKER_PASSWORD` | `your_dockerhub_token` | Docker Hub access token |

### 5. Verify GitHub Secrets

Required secrets for CI/CD:
- ✅ `SSH_PRIVATE_KEY` - Your private SSH key
- ✅ `VPS_HOST` - VPS IP or domain
- ✅ `VPS_USER` - SSH username
- ✅ `VPS_PORT` - SSH port (optional, default: 22)
- ✅ `DOCKER_USERNAME` - Docker Hub username
- ✅ `DOCKER_PASSWORD` - Docker Hub token/password

## 🔒 Security Best Practices

### 1. Use Dedicated Deploy Key
```bash
# Create a separate user for deployments
sudo adduser github-deploy
sudo usermod -aG docker github-deploy

# Use this user for deployments instead of root
```

### 2. Restrict SSH Key Permissions
Add to VPS `~/.ssh/authorized_keys` before the key:
```bash
command="/home/deploy/allowed-commands.sh",no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA...
```

### 3. Use GitHub Environment Protection
- Go to Settings → Environments
- Create "production" environment
- Add required reviewers
- Add deployment branch rules

### 4. Rotate Keys Regularly
```bash
# Generate new key
ssh-keygen -t ed25519 -C "github-actions-deploy-$(date +%Y%m%d)" -f ~/.ssh/deploy_new -N ""

# Test new key
ssh -i ~/.ssh/deploy_new -p $VPS_PORT $VPS_USER@$VPS_HOST

# Update GitHub secret
# Remove old key from VPS authorized_keys
```

## 🧪 Testing Deployment

### Manual Test
```bash
# Trigger workflow manually
# Go to Actions → Build and Deploy to VPS → Run workflow
```

### Push to Main Branch
```bash
git add .
git commit -m "test: CI/CD with SSH key"
git push origin main
```

### Check Logs
1. Go to **Actions** tab
2. Click on the latest workflow run
3. Check each job's logs

## 🐛 Troubleshooting

### Error: "Permission denied (publickey)"

**Solution 1**: Check key format
```bash
# Key should start with:
-----BEGIN OPENSSH PRIVATE KEY-----
# or
-----BEGIN RSA PRIVATE KEY-----
```

**Solution 2**: Check authorized_keys on VPS
```bash
ssh $VPS_USER@$VPS_HOST
cat ~/.ssh/authorized_keys
# Should contain your public key
```

### Error: "Host key verification failed"

**Solution**: The workflow automatically adds host to known_hosts:
```yaml
- name: Setup SSH Key
  run: |
    ssh-keyscan -p ${{ secrets.VPS_PORT }} -H ${{ secrets.VPS_HOST }} >> ~/.ssh/known_hosts
```

### Error: "Bad permissions" on private key

**Solution**: Workflow automatically sets correct permissions:
```yaml
chmod 600 ~/.ssh/id_rsa
```

### Connection Timeout

**Check**:
- VPS firewall allows SSH port
- Security group allows GitHub Actions IPs
- VPS is accessible from internet

```bash
# Test from local machine
ssh -v -p $VPS_PORT $VPS_USER@$VPS_HOST
```

## 📦 Dockerfile Locations

Services use separate Dockerfiles:

```
english-learning/
├── Dockerfile                           # client-api
├── apps/
│   ├── background-worker/
│   │   └── Dockerfile                   # background-worker
│   └── notification/
│       └── Dockerfile                   # notification
```

## 🚀 Deployment Workflow

1. **Trigger**: Push to main/develop or manual dispatch
2. **Build**: Builds 3 Docker images in parallel
   - client-api
   - background-worker
   - notification
3. **Push**: Images pushed to Docker Hub
4. **Deploy**: SSH to VPS and run `docker-compose.prod.yml`
5. **Health Check**: Verify services are running

## 📝 Environment Variables on VPS

Create `.env` file on VPS at `~/english-learning-backend/.env`:

```bash
# Docker
DOCKER_USERNAME=your_dockerhub_username
IMAGE_TAG=latest

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=english_learning

# JWT
JWT_SECRET=your_jwt_secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Kafka
KAFKA_BROKERS=redpanda:9092

# S3/MinIO
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=minio
S3_SECRET_ACCESS_KEY=minio123
S3_BUCKET_NAME=english-learning-bucket

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
FROM=noreply@example.com

# API
CLIENT_API_PORT=3334
API_BASE_URL=http://your-domain.com

# AI Services
GEMINI_API_KEY=your_gemini_key
```

## 🔄 Updating SSH Key

If you need to change the SSH key:

1. Generate new key pair
2. Add public key to VPS
3. Test connection
4. Update `SSH_PRIVATE_KEY` secret in GitHub
5. Remove old public key from VPS (optional)

## 📚 Additional Resources

- [GitHub Actions - SSH Action](https://github.com/marketplace/actions/ssh-remote-commands)
- [SSH Key Management Best Practices](https://www.ssh.com/academy/ssh/keygen)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## ✅ Checklist

Before deploying:
- [ ] SSH key generated and tested
- [ ] Public key added to VPS
- [ ] All GitHub secrets configured
- [ ] `.env` file created on VPS
- [ ] Docker installed on VPS
- [ ] Firewall configured (SSH, HTTP, HTTPS)
- [ ] Domain DNS configured (if applicable)
- [ ] SSL certificates ready (if applicable)

## 🆘 Support

If you encounter issues:
1. Check GitHub Actions logs
2. SSH into VPS and check Docker logs: `docker compose -f docker-compose.prod.yml logs`
3. Verify all secrets are correctly set
4. Check VPS system resources
5. Review firewall rules

---

**Note**: Keep your private key secure! Never commit it to version control or share it publicly.
