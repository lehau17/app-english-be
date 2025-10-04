# GitHub Actions Workflows

## 📋 Available Workflows

### `deploy.yml` - Build and Deploy to VPS

Tự động build Docker images và deploy lên VPS khi push code hoặc trigger thủ công.

**Trigger:**
- Push lên branch `main` hoặc `develop`
- Manual dispatch từ GitHub Actions tab

**Jobs:**
1. **Build**: Build 3 Docker images (client-api, background-worker, notification)
2. **Deploy**: SSH vào VPS và deploy ứng dụng
3. **Notify**: Thông báo kết quả deployment

**Required Secrets:**
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password hoặc access token
- `VPS_HOST`: VPS IP hoặc domain
- `VPS_USER`: SSH username
- `VPS_PASSWORD`: SSH password
- `VPS_PORT`: SSH port (optional, default: 22)

## 🧪 Test Workflow Locally

### Cài đặt act (GitHub Actions local runner)

**macOS:**
```bash
brew install act
```

**Linux:**
```bash
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

**Windows:**
```powershell
choco install act-cli
```

### Tạo file `.secrets` cho testing

```bash
# Tạo file .secrets
cat > .secrets << EOF
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-password
VPS_HOST=your-vps-ip
VPS_USER=your-vps-user
VPS_PASSWORD=your-vps-password
VPS_PORT=22
EOF
```

### Chạy workflow locally

```bash
# List all workflows
act -l

# Run specific job
act -j build --secret-file .secrets

# Run entire workflow
act push --secret-file .secrets

# Run with verbose output
act push --secret-file .secrets -v
```

**Note:** Testing deployment job locally sẽ thực sự SSH vào VPS, nên cẩn thận khi test!

## 🔧 Customization

### Thay đổi branch trigger

Edit `deploy.yml`:
```yaml
on:
  push:
    branches:
      - main
      - develop
      - staging  # Thêm branch mới
```

### Thay đổi môi trường deploy

Edit `deploy.yml` và thêm environment-specific logic:
```yaml
env:
  ENVIRONMENT: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
```

### Thêm notification (Slack, Discord, etc.)

Thêm step cuối workflow:
```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 📊 Monitoring

### View logs

1. Vào repository trên GitHub
2. Click tab **Actions**
3. Chọn workflow run
4. Click vào job để xem logs chi tiết

### Retry failed workflow

Nếu workflow fail, có thể retry:
1. Vào workflow run đã fail
2. Click nút **Re-run jobs**
3. Chọn **Re-run failed jobs** hoặc **Re-run all jobs**

## 🔐 Security Best Practices

1. **Không commit secrets vào code**
2. **Sử dụng GitHub Secrets** cho sensitive data
3. **Rotate credentials** thường xuyên
4. **Review workflow logs** để đảm bảo không leak secrets
5. **Sử dụng SSH keys** thay vì password sau khi test

## 🚀 Advanced Features

### Matrix Build

Để build multiple platforms:
```yaml
strategy:
  matrix:
    platform: [linux/amd64, linux/arm64]
```

### Caching

Để tăng tốc build:
```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### Conditional Deployment

Deploy khác nhau tùy branch:
```yaml
- name: Deploy to Production
  if: github.ref == 'refs/heads/main'
  run: ./deploy.sh production

- name: Deploy to Staging
  if: github.ref == 'refs/heads/develop'
  run: ./deploy.sh staging
```

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [SSH Action](https://github.com/appleboy/ssh-action)
- [act - Run GitHub Actions locally](https://github.com/nektos/act)
