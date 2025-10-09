# Redis Password Authentication Implementation

## Overview
Refactored Redis configuration to support password authentication using `node-redis` client (not ioredis). The implementation provides flexible configuration options for both development and production environments.

## Changes Made

### 1. RedisService Refactor (`libs/shared/src/redis/redis.service.ts`)

**Before**: Simple URL-based configuration
```typescript
const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
this.client = createClient({ url: redisUrl, socket: {...} });
```

**After**: Flexible configuration with password support
```typescript
const redisHost = this.configService.get<string>('REDIS_HOST') || 'localhost';
const redisPort = this.configService.get<number>('REDIS_PORT') || 6379;
const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
const redisDb = this.configService.get<number>('REDIS_DB') || 0;
const redisUrl = this.configService.get<string>('REDIS_URL');

const redisConfig: any = {
  socket: {
    host: redisHost,
    port: redisPort,
    reconnectStrategy: (retries: number) => Math.min(retries * 50, 500),
  },
  database: redisDb,
};

if (redisPassword) {
  redisConfig.password = redisPassword;
}

// REDIS_URL overrides individual configs
if (redisUrl) {
  redisConfig.url = redisUrl;
  delete redisConfig.socket;
  delete redisConfig.password;
  delete redisConfig.database;
}

this.client = createClient(redisConfig);
```

**New Event Listeners**:
- `reconnecting`: Logs reconnection attempts
- `ready`: Logs successful connection

### 2. Environment Variables (`.env.example`)

Added Redis configuration section:

```bash
# ========================================
# Redis Configuration
# ========================================
# Option 1: Use individual configs (recommended for production)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Option 2: Use connection URL (simpler for development)
# REDIS_URL=redis://:password@localhost:6379/0
# For Redis without password: redis://localhost:6379
```

### 3. Docker Compose Configuration (`docker-compose.prod.yml`)

#### Redis Service
Updated to support optional password authentication:

```yaml
redis:
  image: redis:7-alpine
  container_name: redis
  restart: unless-stopped
  command: >
    sh -c '
    if [ -n "$$REDIS_PASSWORD" ]; then
      redis-server --requirepass "$$REDIS_PASSWORD" --appendonly yes;
    else
      redis-server --appendonly yes;
    fi
    '
  environment:
    - REDIS_PASSWORD=${REDIS_PASSWORD}
  ports:
    - "${REDIS_PORT:-6379}:6379"
  volumes:
    - redis_data:/data
  networks:
    - app-network
  healthcheck:
    test:
      - CMD
      - sh
      - -c
      - |
        if [ -n "$$REDIS_PASSWORD" ]; then
          redis-cli -a "$$REDIS_PASSWORD" ping | grep PONG
        else
          redis-cli ping | grep PONG
        fi
    interval: 10s
    timeout: 3s
    retries: 5
```

**Key Features**:
- ✅ Optional password: Works with or without `REDIS_PASSWORD` set
- ✅ AOF persistence enabled: `--appendonly yes`
- ✅ Smart healthcheck: Authenticates only when password exists
- ✅ Secure: Password passed via environment, not command line args

#### Client-API Service
Added Redis environment variables:

```yaml
client-api:
  environment:
    # ... existing vars ...
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - REDIS_PASSWORD=${REDIS_PASSWORD}
    - REDIS_DB=${REDIS_DB:-0}
```

#### Background-Worker Service
Added same Redis environment variables:

```yaml
background-worker:
  environment:
    # ... existing vars ...
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - REDIS_PASSWORD=${REDIS_PASSWORD}
    - REDIS_DB=${REDIS_DB:-0}
```

## Configuration Options

### Option 1: Individual Configs (Production - Recommended)
Set individual environment variables:
```bash
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
```

**Advantages**:
- More explicit and readable
- Easier to configure different parameters
- Recommended for production environments

### Option 2: Connection URL (Development)
Use a single connection string:
```bash
# With password:
REDIS_URL=redis://:password@localhost:6379/0

# Without password (development):
REDIS_URL=redis://localhost:6379
```

**Advantages**:
- Simpler for local development
- URL overrides individual configs if both are set

## Deployment Instructions

### VPS Setup
1. **Add to VPS `.env` file** (`~/english-learning-backend/.env`):
   ```bash
   # Redis Configuration
   REDIS_HOST=redis
   REDIS_PORT=6379
   REDIS_PASSWORD=generate-strong-password-here
   REDIS_DB=0
   ```

2. **Generate secure password**:
   ```bash
   # Generate random password
   openssl rand -base64 32
   ```

3. **Deploy with docker-compose**:
   ```bash
   cd ~/english-learning-backend
   docker compose -f docker-compose.prod.yml up -d redis
   docker compose -f docker-compose.prod.yml restart client-api background-worker
   ```

### Verify Connection
Check logs for successful Redis connection:
```bash
# Check Redis is running with password
docker logs redis

# Check client-api connects successfully
docker logs english-learning-api | grep -i redis

# Test Redis authentication manually
docker exec -it redis redis-cli -a YOUR_PASSWORD ping
# Should return: PONG
```

## Security Best Practices

1. **Use Strong Passwords**:
   - Minimum 32 characters
   - Use random generation: `openssl rand -base64 32`

2. **Protect Environment Variables**:
   - Never commit `.env` to version control
   - Use `.env.example` as template only

3. **Network Security**:
   - Redis runs in internal Docker network (`app-network`)
   - Not exposed to public internet by default
   - Only accessible by services in same network

4. **Persistence**:
   - AOF (Append-Only File) enabled for data durability
   - Data persisted in `redis_data` volume

## Troubleshooting

### Connection Failed
```bash
# Check Redis is running
docker ps | grep redis

# Check Redis logs
docker logs redis

# Test connection without password (should fail if password set)
docker exec -it redis redis-cli ping
# Should return: (error) NOAUTH Authentication required.

# Test with password
docker exec -it redis redis-cli -a YOUR_PASSWORD ping
# Should return: PONG
```

### Wrong Password
```bash
# Client-api logs will show:
# [Redis] Error: WRONGPASS invalid username-password pair

# Solution: Check REDIS_PASSWORD in .env matches Redis server password
```

### Connection Timeout
```bash
# Check Redis healthcheck status
docker inspect redis | grep -A 10 Health

# Restart Redis if unhealthy
docker compose -f docker-compose.prod.yml restart redis
```

## Testing

### Local Development (No Password)
```bash
# .env
REDIS_URL=redis://localhost:6379

# Start Redis without password
docker run -d -p 6379:6379 redis:7-alpine
```

### Production (With Password)
```bash
# .env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=secure-password
REDIS_DB=0

# Start with docker-compose
docker compose -f docker-compose.prod.yml up -d
```

## Migration Notes

**Existing Deployments**:
- If Redis currently has no password, can be enabled without data loss
- Add `REDIS_PASSWORD` to `.env`
- Restart Redis: `docker compose restart redis`
- Restart services: `docker compose restart client-api background-worker`

**Backward Compatibility**:
- Password is optional: works without `REDIS_PASSWORD` set
- Existing `REDIS_URL` configurations still work
- No breaking changes to existing deployments

## Related Files
- `libs/shared/src/redis/redis.service.ts` - Redis client service
- `.env.example` - Environment variable template
- `docker-compose.prod.yml` - Production Docker configuration

## References
- Redis AUTH: https://redis.io/docs/management/security/
- node-redis: https://github.com/redis/node-redis
- Docker Redis: https://hub.docker.com/_/redis
