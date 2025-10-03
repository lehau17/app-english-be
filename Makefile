.PHONY: help build build-all push push-all deploy logs stop clean test

# Variables
DOCKER_USERNAME ?= $(shell grep DOCKER_USERNAME .env 2>/dev/null | cut -d '=' -f2)
IMAGE_TAG ?= latest

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)English Learning Backend - CI/CD Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

build-client-api: ## Build client-api Docker image
	@echo "$(BLUE)Building client-api image...$(NC)"
	docker build --build-arg APP_NAME=client-api -t $(DOCKER_USERNAME)/english-learning-client-api:$(IMAGE_TAG) .

build-background-worker: ## Build background-worker Docker image
	@echo "$(BLUE)Building background-worker image...$(NC)"
	docker build --build-arg APP_NAME=background-worker -t $(DOCKER_USERNAME)/english-learning-background-worker:$(IMAGE_TAG) .

build-notification: ## Build notification Docker image
	@echo "$(BLUE)Building notification image...$(NC)"
	docker build --build-arg APP_NAME=notification -t $(DOCKER_USERNAME)/english-learning-notification:$(IMAGE_TAG) .

build-all: build-client-api build-background-worker build-notification ## Build all Docker images
	@echo "$(GREEN)✓ All images built successfully$(NC)"

push-client-api: ## Push client-api image to Docker Hub
	@echo "$(BLUE)Pushing client-api image...$(NC)"
	docker push $(DOCKER_USERNAME)/english-learning-client-api:$(IMAGE_TAG)

push-background-worker: ## Push background-worker image to Docker Hub
	@echo "$(BLUE)Pushing background-worker image...$(NC)"
	docker push $(DOCKER_USERNAME)/english-learning-background-worker:$(IMAGE_TAG)

push-notification: ## Push notification image to Docker Hub
	@echo "$(BLUE)Pushing notification image...$(NC)"
	docker push $(DOCKER_USERNAME)/english-learning-notification:$(IMAGE_TAG)

push-all: push-client-api push-background-worker push-notification ## Push all images to Docker Hub
	@echo "$(GREEN)✓ All images pushed successfully$(NC)"

deploy: ## Deploy to production using docker-compose
	@echo "$(BLUE)Deploying to production...$(NC)"
	./deploy.sh

logs: ## Show logs from all services
	docker compose -f docker-compose.prod.yml logs -f

logs-api: ## Show logs from client-api service
	docker compose -f docker-compose.prod.yml logs -f client-api

logs-worker: ## Show logs from background-worker service
	docker compose -f docker-compose.prod.yml logs -f background-worker

logs-notification: ## Show logs from notification service
	docker compose -f docker-compose.prod.yml logs -f notification

status: ## Show status of all services
	docker compose -f docker-compose.prod.yml ps

stop: ## Stop all services
	@echo "$(YELLOW)Stopping all services...$(NC)"
	docker compose -f docker-compose.prod.yml stop

restart: ## Restart all services
	@echo "$(BLUE)Restarting all services...$(NC)"
	docker compose -f docker-compose.prod.yml restart

clean: ## Remove all containers and volumes
	@echo "$(RED)Removing all containers and volumes...$(NC)"
	docker compose -f docker-compose.prod.yml down -v

health: ## Check health of services
	@echo "$(BLUE)Checking service health...$(NC)"
	@curl -s http://localhost:3334/api/health || echo "$(RED)API not responding$(NC)"

dev: ## Start development environment
	docker compose up -d

dev-logs: ## Show development logs
	docker compose logs -f

dev-stop: ## Stop development environment
	docker compose stop

dev-clean: ## Clean development environment
	docker compose down -v

test: ## Run tests
	npm run test

lint: ## Run linter
	npm run lint

prisma-generate: ## Generate Prisma client
	npm run prisma:generate

prisma-migrate: ## Run Prisma migrations
	npm run prisma:migrate

prisma-studio: ## Open Prisma Studio
	npm run prisma:studio

docker-login: ## Login to Docker Hub
	@echo "$(BLUE)Logging in to Docker Hub...$(NC)"
	docker login

stats: ## Show Docker resource usage
	docker stats

prune: ## Remove unused Docker resources
	@echo "$(YELLOW)Cleaning up Docker resources...$(NC)"
	docker system prune -a --volumes

backup-db: ## Backup PostgreSQL database
	@echo "$(BLUE)Backing up database...$(NC)"
	docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres english_learning > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backed up$(NC)"

restore-db: ## Restore PostgreSQL database (usage: make restore-db FILE=backup.sql)
	@echo "$(BLUE)Restoring database from $(FILE)...$(NC)"
	cat $(FILE) | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres english_learning
	@echo "$(GREEN)✓ Database restored$(NC)"

.DEFAULT_GOAL := help
