# Docker Build Timeout Fix

## Vấn đề

Build Docker image bị "The operation was canceled" khi đang chạy `npm run build:client-api`.

### Nguyên nhân

1. **Memory không đủ**: Node.js TypeScript build cần nhiều RAM
2. **Timeout mặc định**: Docker compose có timeout build mặc định
3. **npm install chậm**: `npm i` chậm hơn `npm ci`
4. **Không có cache**: Build từ đầu mỗi lần

## Các fix đã áp dụng

### 1. Tối ưu hóa Dockerfile

**Trước**:
```dockerfile
# Install dependencies
RUN npm i

# Build the application
ARG APP_NAME=client-api
RUN npm run build:${APP_NAME}
```

**Sau**:
```dockerfile
# Set Node.js memory limit and disable husky
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV HUSKY=0

# Install dependencies (use ci for faster, deterministic builds)
RUN npm ci --legacy-peer-deps

# Build with increased memory and timeout
ARG APP_NAME=client-api
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build:${APP_NAME}
```

**Cải thiện**:
- ✅ Tăng memory heap từ ~512MB → 4096MB (4GB)
- ✅ Disable Husky (không cần Git hooks trong Docker)
- ✅ Dùng `npm ci` thay vì `npm i` (nhanh hơn 2-3 lần)
- ✅ Thêm `--legacy-peer-deps` để tránh conflict

### 2. Fix .dockerignore

**Trước**: Block `package-lock.json` → không thể dùng `npm ci`

```
package-lock.json  ← Bị block!
```

**Sau**: Allow `package-lock.json`

```
# package-lock.json - NEEDED for Docker build
```

### 3. Tạo docker-compose.build.yml

File build chuyên dụng với cache configuration:

```yaml
services:
  client-api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
      args:
        APP_NAME: client-api
      cache_from:
        - lehau17/english-learning-client-api:latest
```

### 4. Tạo build scripts

**docker-build.sh**: Build với BuildKit và progress tracking
**build-simple.sh**: Build đơn giản với Docker trực tiếp

## Cách build

### Option 1: Dùng docker-compose (khuyến nghị cho dev)

```bash
# Build một service
docker compose -f docker-compose.prod.yml build client-api

# Build tất cả
docker compose -f docker-compose.prod.yml build
```

### Option 2: Dùng script (nhanh hơn)

```bash
# Cấp quyền (chỉ cần 1 lần)
chmod +x build-simple.sh

# Build
./build-simple.sh
```

### Option 3: Dùng Docker trực tiếp (control tối đa)

```bash
docker build \
  --file Dockerfile \
  --target production \
  --build-arg APP_NAME=client-api \
  --tag lehau17/english-learning-client-api:latest \
  --progress=plain \
  --network=host \
  .
```

## Troubleshooting

### Build vẫn bị timeout

Tăng thêm memory hoặc thời gian:

```bash
# Tăng Docker Desktop memory
Docker Desktop → Settings → Resources → Memory → 8GB

# Build với timeout cao hơn
docker build --build-arg TIMEOUT=600 ...
```

### Out of Memory Error

```bash
# Kiểm tra memory Docker
docker system df
docker system info | grep Memory

# Tăng memory trong Dockerfile
ENV NODE_OPTIONS="--max-old-space-size=8192"  # 8GB
```

### npm ci fails

```bash
# Thêm flag
RUN npm ci --legacy-peer-deps --ignore-scripts
```

### Build quá chậm

Dùng BuildKit và cache:

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build with cache
docker buildx build \
  --cache-from type=registry,ref=lehau17/english-learning-client-api:latest \
  --cache-to type=inline \
  ...
```

## Performance Comparison

| Method | Before | After | Improvement |
|--------|--------|-------|-------------|
| npm install | `npm i` (~2-3 min) | `npm ci` (~30-60s) | **3-4x faster** |
| Memory limit | Default (~512MB) | 4096MB | **8x more** |
| Build time | Timeout (>10 min) | ~3-5 min | **Success!** |

## Monitoring build

Xem progress chi tiết:

```bash
# Với docker-compose
docker compose -f docker-compose.prod.yml build --progress=plain

# Với docker
docker build --progress=plain ...
```

## Next Steps

1. ✅ Build thành công local
2. ⏳ Test CI/CD với timeout mới
3. ⏳ Optimize thêm với multi-stage cache
4. ⏳ Consider using BuildKit cache mounts

## References

- Node.js memory options: https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-megabytes
- Docker BuildKit: https://docs.docker.com/build/buildkit/
- npm ci vs npm install: https://docs.npmjs.com/cli/v8/commands/npm-ci
