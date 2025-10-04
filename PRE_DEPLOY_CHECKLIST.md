# Pre-Deployment Checklist ✅

## 📋 Before First Deployment

### GitHub Configuration
- [ ] Repository created and code pushed
- [ ] GitHub Secrets configured:
  - [ ] `DOCKER_USERNAME`
  - [ ] `DOCKER_PASSWORD`
  - [ ] `VPS_HOST`
  - [ ] `VPS_USER`
  - [ ] `VPS_PASSWORD`
  - [ ] `VPS_PORT` (optional)

### Docker Hub Configuration
- [ ] Docker Hub account created
- [ ] Three repositories created:
  - [ ] `english-learning-client-api`
  - [ ] `english-learning-background-worker`
  - [ ] `english-learning-notification`
- [ ] Repositories set to public (or ensure credentials are correct for private)

### VPS Configuration
- [ ] VPS provisioned (Ubuntu 20.04+ or Debian 11+ recommended)
- [ ] SSH access verified: `ssh user@vps-ip`
- [ ] Docker installed: `docker --version`
- [ ] Docker Compose installed: `docker compose version`
- [ ] User has Docker permissions (or using root)
- [ ] Required ports open:
  - [ ] 22 (SSH)
  - [ ] 3334 (API)
  - [ ] 80 (HTTP - optional for reverse proxy)
  - [ ] 443 (HTTPS - optional for SSL)

### Environment Configuration
- [ ] `.env` file created on VPS at `~/english-learning-backend/.env`
- [ ] All required environment variables configured:
  - [ ] Database credentials (change defaults!)
  - [ ] JWT secret (long and random!)
  - [ ] MinIO/S3 credentials (change defaults!)
  - [ ] SMTP configuration (if using email)
  - [ ] Gemini API key (if using AI features)
  - [ ] Docker username
- [ ] Sensitive data (passwords, secrets) changed from defaults

## 🔐 Security Checklist

- [ ] All default passwords changed
- [ ] JWT secret is long (64+ characters) and random
- [ ] Database password is strong
- [ ] MinIO credentials are strong
- [ ] Firewall configured (ufw or iptables)
- [ ] SSH key authentication planned (switch from password after testing)
- [ ] Regular backup strategy planned

## 🚀 Deployment Readiness

### Local Testing
- [ ] Code builds locally: `npm run build`
- [ ] Tests pass: `npm run test`
- [ ] Linting passes: `npm run lint`
- [ ] Docker build tested: `make build-all` (or manual build)

### Infrastructure Testing
- [ ] Can SSH into VPS: `ssh user@vps-ip`
- [ ] Docker works on VPS: `docker ps`
- [ ] Can pull from Docker Hub: `docker pull hello-world`
- [ ] Sufficient disk space: `df -h` (recommend 20GB+ free)
- [ ] Sufficient RAM: `free -h` (recommend 2GB+ available)

### Network Testing
- [ ] Ports accessible from GitHub Actions runner
- [ ] API port (3334) accessible externally (if needed)
- [ ] Domain configured (if using custom domain)
- [ ] DNS records set (if using custom domain)

## 📊 First Deployment Steps

1. **Verify all checkboxes above are completed**
2. **Trigger deployment:**
   ```bash
   git push origin main
   ```
3. **Monitor deployment:**
   - Watch GitHub Actions tab
   - SSH into VPS and monitor: `docker compose -f docker-compose.prod.yml logs -f`
4. **Verify deployment:**
   ```bash
   curl http://vps-ip:3334/api/health
   ```
5. **Access Swagger docs:**
   - Open browser: `http://vps-ip:3334/api/docs`

## 🔍 Post-Deployment Verification

- [ ] All containers running: `docker compose -f docker-compose.prod.yml ps`
- [ ] No error logs: `docker compose -f docker-compose.prod.yml logs | grep -i error`
- [ ] API health check passes: `curl http://vps-ip:3334/api/health`
- [ ] Swagger docs accessible: `http://vps-ip:3334/api/docs`
- [ ] Database migrations applied
- [ ] Background worker running
- [ ] Notification service running

## 🎯 Optional Enhancements

### SSL/TLS Setup
- [ ] Install Nginx reverse proxy
- [ ] Install Certbot for Let's Encrypt
- [ ] Configure SSL certificates
- [ ] Redirect HTTP to HTTPS

### Monitoring
- [ ] Setup logging aggregation (e.g., ELK stack)
- [ ] Configure health check monitoring
- [ ] Setup uptime monitoring (e.g., UptimeRobot)
- [ ] Configure alerts for failures

### Backup
- [ ] Automated database backups configured
- [ ] Backup retention policy defined
- [ ] Backup restoration tested
- [ ] MinIO data backup configured

### CI/CD Enhancements
- [ ] Staging environment setup
- [ ] Blue-green deployment strategy
- [ ] Rollback procedure documented
- [ ] Slack/Discord notifications configured

## 📞 Emergency Contacts

Document key contacts for production issues:

- **DevOps Lead:** [Name/Contact]
- **Backend Lead:** [Name/Contact]
- **VPS Provider Support:** [Contact/URL]
- **Docker Hub Support:** https://hub.docker.com/support

## 📚 Quick Reference

### Essential Commands
```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop all services
docker compose -f docker-compose.prod.yml stop

# Emergency troubleshooting
./troubleshoot.sh --all
```

### Important URLs
- GitHub Actions: https://github.com/YOUR_USERNAME/app-english-be/actions
- Docker Hub: https://hub.docker.com/u/YOUR_USERNAME
- VPS Dashboard: [Your VPS provider URL]
- API Swagger: http://YOUR_VPS_IP:3334/api/docs

---

**Last Reviewed:** [Date]  
**Reviewed By:** [Name]

✅ **All checks completed? Ready to deploy!** 🚀
