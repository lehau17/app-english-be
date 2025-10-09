# Kafka Connection Timeout Increase

## Problem
Kafka consumer experiencing connection timeouts after 10 seconds when connecting to broker `34.123.45.67:19092`:

```
{"level":"ERROR","timestamp":"2025-10-09T19:02:07.926Z","logger":"kafkajs","message":"[Connection] Connection timeout","broker":"34.123.45.67:19092","clientId":"gas-station-backend"}
```

## Solution
Increased Kafka connection and request timeouts from 10 seconds to 30 seconds.

## Changes Made

### 1. Updated `libs/shared/src/kafka/kafka-config.service.ts`

**Consumer Config**:
```typescript
// Before:
connectionTimeout: 10000,  // 10 seconds
requestTimeout: 30000,

// After:
const connectionTimeout = this.configService.get<number>('KAFKA_CONNECTION_TIMEOUT', 30000);
const requestTimeout = this.configService.get<number>('KAFKA_REQUEST_TIMEOUT', 30000);

connectionTimeout,  // 30 seconds (default)
requestTimeout,
```

**Producer Config**:
```typescript
// Same changes - increased from 10000ms to 30000ms
connectionTimeout: 30000,
requestTimeout: 30000,
```

### 2. Updated `.env.example`

Added configurable Kafka timeout settings:

```bash
# ========================================
# Kafka Configuration
# ========================================
KAFKA_BROKERS=localhost:19092
KAFKA_CONNECTION_TIMEOUT=30000
KAFKA_REQUEST_TIMEOUT=30000
```

## Configuration Options

### Use Default (30 seconds)
No need to set environment variables - defaults to 30000ms:

```bash
# .env
KAFKA_BROKERS=34.123.45.67:19092
```

### Custom Timeout
Override with custom values:

```bash
# .env
KAFKA_BROKERS=34.123.45.67:19092
KAFKA_CONNECTION_TIMEOUT=60000  # 60 seconds
KAFKA_REQUEST_TIMEOUT=60000     # 60 seconds
```

## Impact

**Before**:
- Connection timeout: 10 seconds
- Result: Frequent timeouts when network is slow

**After**:
- Connection timeout: 30 seconds (3x longer)
- Result: More time for connection establishment
- Retry mechanism still active (5 retries with backoff)

## Testing

Restart the backend to apply changes:

```bash
# Kill current process (Ctrl+C)
# Then restart
npm run start:client-api:dev
```

Monitor logs for successful connection:

```bash
# Should see these instead of timeout errors:
[Nest] LOG [NotificationListener] ✅ Notification listener connected to Kafka
[Nest] LOG [NotificationListener] ✅ Subscribed to topic: notify-send-otp
{"level":"INFO","logger":"kafkajs","message":"[Consumer] Starting"}
```

## Troubleshooting

### Still Getting Timeouts
If 30 seconds is not enough, increase further:

```bash
# .env
KAFKA_CONNECTION_TIMEOUT=60000  # 60 seconds
KAFKA_REQUEST_TIMEOUT=60000
```

### Verify Kafka Broker Accessibility
```bash
# Test network connection
telnet 34.123.45.67 19092

# Or using nc
nc -zv 34.123.45.67 19092
```

### Check Kafka Broker Status
```bash
# If using docker-compose
docker ps | grep redpanda

# Check logs
docker logs redpanda
```

### Firewall Issues
If running remotely, ensure:
- Port 19092 is open in firewall
- Security group allows inbound connections
- Network latency is acceptable

## Related Files
- `libs/shared/src/kafka/kafka-config.service.ts` - Kafka configuration
- `.env.example` - Environment variable template
- `apps/client-api/src/events/notification.listener.ts` - Notification consumer
- `apps/notification/src/notification.listener.ts` - Notification app consumer
- `apps/background-worker/src/tts/tts.listener.ts` - TTS listener
- `apps/background-worker/src/neo4j/neo4j-sync.listener.ts` - Neo4j sync listener

## References
- KafkaJS Configuration: https://kafka.js.org/docs/configuration
- Connection Timeout: https://kafka.js.org/docs/configuration#connection-timeout
