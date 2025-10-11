# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV HUSKY=0

COPY package*.json tsconfig*.json nest-cli.json ./
RUN npm ci --legacy-peer-deps

COPY libs ./libs
COPY apps ./apps
COPY prisma ./prisma

RUN npm run prisma:generate

ARG APP_NAME=client-api
RUN npm run build:${APP_NAME}

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

ARG APP_NAME=client-api
ENV APP_NAME=${APP_NAME}

EXPOSE 3000

CMD ["node", "dist/apps/client-api/main.js"]
