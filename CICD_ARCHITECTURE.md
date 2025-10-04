# CI/CD Architecture Overview

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Developer                                │
│                    (Push code to GitHub)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Repository                           │
│  • main / develop branch                                        │
│  • .github/workflows/deploy.yml                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Runner                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Build Job (Matrix: 3 apps in parallel)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │ client-api  │  │   worker    │  │notification │      │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │  │
│  │         │                 │                 │             │  │
│  │         └─────────────────┴─────────────────┘             │  │
│  │                           │                                │  │
│  │                   Build Docker Images                      │  │
│  │                           │                                │  │
│  └───────────────────────────┼────────────────────────────────┘  │
└────────────────────────────┬─┴────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Docker Hub                                 │
│  • english-learning-client-api:latest                           │
│  • english-learning-background-worker:latest                    │
│  • english-learning-notification:latest                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Deploy Job (SSH)                             │
│  1. sshpass connects to VPS                                     │
│  2. Copy deployment files                                       │
│  3. Pull latest images                                          │
│  4. Run deploy.sh                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         VPS Server                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Docker Compose Production                    │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Application Services                               │ │  │
│  │  │  • client-api (Port 3334)                          │ │  │
│  │  │  • background-worker                               │ │  │
│  │  │  • notification                                    │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Infrastructure Services                            │ │  │
│  │  │  • postgres (pgvector)                             │ │  │
│  │  │  • redis                                           │ │  │
│  │  │  • redpanda (Kafka)                                │ │  │
│  │  │  • minio (S3)                                      │ │  │
│  │  │  • piper-tts (Text-to-Speech)                      │ │  │
│  │  │  • vosk-asr (Speech Recognition)                   │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      End Users                                   │
│  • Web App → API (Port 3334)                                   │
│  • Mobile App → API (Port 3334)                                │
│  • Swagger Docs → http://vps:3334/api/docs                     │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Deployment Flow Details

### 1. Code Push Trigger
```
Developer → GitHub → Webhook → GitHub Actions
```

**Triggers:**
- Push to `main` branch (production)
- Push to `develop` branch (staging/dev)
- Manual workflow dispatch

### 2. Build Phase (Parallel)
```
GitHub Runner
├── Build client-api
│   ├── npm ci
│   ├── prisma generate
│   └── nest build client-api
├── Build background-worker
│   ├── npm ci
│   ├── prisma generate
│   └── nest build background-worker
└── Build notification
    ├── npm ci
    ├── prisma generate
    └── nest build notification
```

**Build Arguments:**
- `APP_NAME`: Determines which app to build
- Uses multi-stage Dockerfile for optimization

### 3. Push Phase
```
Docker Hub
├── english-learning-client-api
│   ├── latest
│   └── {commit-sha}
├── english-learning-background-worker
│   ├── latest
│   └── {commit-sha}
└── english-learning-notification
    ├── latest
    └── {commit-sha}
```

### 4. Deploy Phase
```
GitHub Actions → SSH → VPS
├── Create deployment directory
├── Copy files
│   ├── docker-compose.prod.yml
│   ├── deploy.sh
│   └── .env.example
├── Export environment variables
├── Run deploy.sh
│   ├── Pull latest images
│   ├── Stop old containers
│   ├── Run migrations
│   └── Start new containers
└── Health check
```

## 🔐 Security Flow

```
Secrets Management
├── GitHub Secrets (encrypted at rest)
│   ├── DOCKER_USERNAME
│   ├── DOCKER_PASSWORD
│   ├── VPS_HOST
│   ├── VPS_USER
│   └── VPS_PASSWORD
├── VPS .env file (application secrets)
│   ├── DATABASE_URL
│   ├── JWT_SECRET
│   ├── GEMINI_API_KEY
│   └── Other app secrets
└── Docker Networks (isolated)
    └── app-network
```

## 📊 Service Communication

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Network: app-network                   │
│                                                                   │
│  ┌──────────────┐                                               │
│  │  client-api  │◄─────── HTTP (Port 3334)                     │
│  │   (REST +    │                                               │
│  │  Socket.IO)  │                                               │
│  └─────┬────────┘                                               │
│        │                                                         │
│        ├──────────► postgres (PostgreSQL + pgvector)           │
│        │                                                         │
│        ├──────────► redis (Cache + Sessions)                   │
│        │                                                         │
│        ├──────────► redpanda (Kafka)                           │
│        │                                                         │
│        ├──────────► minio (S3 Storage)                         │
│        │                                                         │
│        ├──────────► piper-tts (Text-to-Speech)                 │
│        │                                                         │
│        └──────────► vosk-asr (Speech Recognition)              │
│                                                                   │
│  ┌──────────────────┐                                           │
│  │ background-worker│                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│           ├──────────► postgres (Cron jobs)                     │
│           │                                                      │
│           ├──────────► redpanda (Produce events)                │
│           │                                                      │
│           └──────────► minio (File processing)                  │
│                                                                   │
│  ┌──────────────┐                                               │
│  │ notification │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ├──────────► redpanda (Consume: notifications)          │
│         │                                                        │
│         ├──────────► postgres (User data)                       │
│         │                                                        │
│         └──────────► SMTP Server (Send emails)                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🚦 Health Check Flow

```
Health Check System
├── Docker Compose healthchecks
│   ├── postgres: pg_isready
│   ├── redis: redis-cli ping
│   ├── redpanda: rpk cluster info
│   ├── minio: curl /minio/health/live
│   └── client-api: HTTP GET /api/health
└── GitHub Actions health check
    └── curl http://vps:3334/api/health (after deploy)
```

## 🔄 Rollback Strategy

```
Rollback Process
├── Identify issue
│   └── Monitor logs: docker compose logs
├── Determine rollback target
│   └── Previous commit SHA or 'latest' tag
├── Execute rollback
│   ├── export IMAGE_TAG={previous-sha}
│   ├── docker compose pull
│   └── docker compose up -d
└── Verify rollback
    └── Health check + smoke test
```

## 📈 Scaling Considerations

### Horizontal Scaling
```
Load Balancer (Nginx/HAProxy)
├── client-api-1
├── client-api-2
└── client-api-N

Shared Services (Single instances)
├── postgres (with replication for HA)
├── redis (with Sentinel for HA)
├── redpanda (cluster mode)
└── minio (distributed mode)
```

### Vertical Scaling
```
Resource Allocation
├── client-api: 1-2 CPU, 2-4GB RAM
├── background-worker: 0.5-1 CPU, 1-2GB RAM
├── notification: 0.5-1 CPU, 1GB RAM
├── postgres: 2-4 CPU, 4-8GB RAM
├── redis: 0.5-1 CPU, 512MB-1GB RAM
└── redpanda: 1-2 CPU, 2-4GB RAM
```

## 🎯 Performance Optimizations

### Build Optimizations
- Multi-stage Docker builds (smaller images)
- Layer caching for faster rebuilds
- npm ci (clean install for reproducibility)

### Runtime Optimizations
- Production mode (NODE_ENV=production)
- Optimized Node.js flags (--max-old-space-size)
- Connection pooling (database, redis)
- Compressed responses

### Network Optimizations
- Single Docker network for internal communication
- Health checks to prevent routing to unhealthy containers
- Keep-alive connections

## 📊 Monitoring Points

```
Monitoring Stack
├── Application Metrics
│   ├── Response times
│   ├── Error rates
│   └── Request counts
├── Infrastructure Metrics
│   ├── CPU usage
│   ├── Memory usage
│   ├── Disk I/O
│   └── Network I/O
├── Container Metrics
│   ├── Container status
│   ├── Restart counts
│   └── Resource limits
└── Business Metrics
    ├── Active users
    ├── API usage
    └── Feature adoption
```

## 🔮 Future Enhancements

- [ ] Kubernetes migration for better orchestration
- [ ] Prometheus + Grafana for monitoring
- [ ] ELK stack for centralized logging
- [ ] ArgoCD for GitOps workflow
- [ ] Vault for secrets management
- [ ] Istio for service mesh
- [ ] Multi-region deployment
- [ ] Blue-green deployment strategy
- [ ] Automated performance testing
- [ ] Chaos engineering integration

---

**Architecture Version:** 1.0  
**Last Updated:** 2024  
**Maintained By:** DevOps Team
