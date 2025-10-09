# Multi-stage Dockerfile for NestJS monorepo
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY package-lock.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm i

# Copy source code
COPY libs ./libs
COPY apps ./apps
COPY prisma ./prisma

# Generate Prisma Client
RUN npm run prisma:generate

# Build the application
# ARG APP_NAME will be passed during build
ARG APP_NAME=client-api
RUN npm run build:${APP_NAME}

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy prisma schema for migrations
COPY prisma ./prisma

# Copy entrypoint script
COPY docker-entrypoint.sh ./

# ARG to determine which app to run
ARG APP_NAME=client-api
ENV APP_NAME=${APP_NAME}

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app && \
    chmod +x docker-entrypoint.sh

USER nestjs

# Expose port (default for client-api)
EXPOSE 3334

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the entrypoint script
CMD ["./docker-entrypoint.sh"]
