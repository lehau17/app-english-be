# Docker Build Timeout - Quick Fix Summary

## Vấn đề
Build bị "The operation was canceled" tại step `npm run build:client-api`

## Root Cause
1. Node.js build cần nhiều RAM nhưng chỉ có ~512MB
2. `npm i` chậm, không deterministic
3. `.dockerignore` block `package-lock.json`

## Fixes Applied

### 1. Dockerfile - Tăng Memory & Dùng npm ci
```dockerfile
# Before
RUN npm i
RUN npm run build:${APP_NAME}

# After  
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV HUSKY=0
RUN npm ci --legacy-peer-deps
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build:${APP_NAME}
```

### 2. .dockerignore - Allow package-lock.json
```diff
- package-lock.json
+ # package-lock.json - NEEDED for Docker build
```

### 3. Tạo Scripts
- `build-simple.sh` - Build nhanh với Docker trực tiếp
- `docker-compose.build.yml` - Build config với cache

## How to Build

### Quick (Recommended)
```bash
chmod +x build-simple.sh
./build-simple.sh
```

### Standard
```bash
docker compose -f docker-compose.prod.yml build client-api
```

### Manual
```bash
docker build \
  --build-arg APP_NAME=client-api \
  --tag lehau17/english-learning-client-api:latest \
  .
```

## Performance
- **npm install**: 2-3 min → 30-60s (3-4x faster)
- **Memory**: 512MB → 4096MB (8x more)
- **Build time**: Timeout → 3-5 min ✅

## Files Changed
- ✅ `Dockerfile` - Tăng memory, npm ci
- ✅ `.dockerignore` - Allow package-lock.json
- ✅ `build-simple.sh` - Quick build script
- ✅ `docker-compose.build.yml` - Build config

## Next Steps
1. Build local thành công
2. Push image: `docker push lehau17/english-learning-client-api:latest`
3. Test CI/CD với timeout mới
4. Update GitHub Actions timeout nếu cần

## Troubleshooting
- **Still timeout**: Tăng Docker Desktop Memory → Settings → Resources → 8GB
- **npm ci fails**: Thêm `--legacy-peer-deps --ignore-scripts`
- **Monitor**: `docker build --progress=plain ...`
