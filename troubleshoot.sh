#!/bin/bash

# Troubleshooting script for English Learning Backend deployment

set -e

echo "🔍 English Learning Backend - Troubleshooting Tool"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if docker is installed
check_docker() {
    echo -e "${BLUE}Checking Docker installation...${NC}"
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓ Docker is installed${NC}"
        docker --version
    else
        echo -e "${RED}✗ Docker is not installed${NC}"
        echo "Install Docker: curl -fsSL https://get.docker.com | sh"
        return 1
    fi
}

# Check if docker-compose is available
check_docker_compose() {
    echo -e "${BLUE}Checking Docker Compose...${NC}"
    if docker compose version &> /dev/null; then
        echo -e "${GREEN}✓ Docker Compose is available${NC}"
        docker compose version
    else
        echo -e "${RED}✗ Docker Compose is not available${NC}"
        return 1
    fi
}

# Check if .env file exists
check_env_file() {
    echo -e "${BLUE}Checking .env file...${NC}"
    if [ -f .env ]; then
        echo -e "${GREEN}✓ .env file exists${NC}"
        echo "Required variables:"
        grep -E "^(DATABASE_URL|JWT_SECRET|DOCKER_USERNAME)" .env || echo -e "${YELLOW}⚠ Some required variables might be missing${NC}"
    else
        echo -e "${RED}✗ .env file not found${NC}"
        echo "Create .env file from .env.production.example"
        return 1
    fi
}

# Check Docker images
check_images() {
    echo -e "${BLUE}Checking Docker images...${NC}"
    if [ -f .env ]; then
        source .env
    fi
    
    DOCKER_USERNAME=${DOCKER_USERNAME:-"unknown"}
    
    for app in client-api background-worker notification; do
        if docker images | grep -q "english-learning-${app}"; then
            echo -e "${GREEN}✓ Image for ${app} found${NC}"
        else
            echo -e "${YELLOW}⚠ Image for ${app} not found locally${NC}"
        fi
    done
}

# Check running containers
check_containers() {
    echo -e "${BLUE}Checking running containers...${NC}"
    
    if [ ! -f docker-compose.prod.yml ]; then
        echo -e "${YELLOW}⚠ docker-compose.prod.yml not found${NC}"
        return 1
    fi
    
    containers=$(docker compose -f docker-compose.prod.yml ps -q 2>/dev/null | wc -l)
    
    if [ "$containers" -gt 0 ]; then
        echo -e "${GREEN}✓ Found $containers running containers${NC}"
        docker compose -f docker-compose.prod.yml ps
    else
        echo -e "${YELLOW}⚠ No containers are running${NC}"
        echo "Start containers: docker compose -f docker-compose.prod.yml up -d"
    fi
}

# Check container logs for errors
check_logs() {
    echo -e "${BLUE}Checking recent logs for errors...${NC}"
    
    if [ ! -f docker-compose.prod.yml ]; then
        return 1
    fi
    
    for service in client-api background-worker notification postgres redis; do
        echo -e "${YELLOW}Checking ${service}...${NC}"
        errors=$(docker compose -f docker-compose.prod.yml logs --tail=50 $service 2>/dev/null | grep -i "error" | wc -l)
        
        if [ "$errors" -gt 0 ]; then
            echo -e "${RED}✗ Found $errors error(s) in ${service}${NC}"
            echo "View logs: docker compose -f docker-compose.prod.yml logs $service"
        else
            echo -e "${GREEN}✓ No errors found in ${service}${NC}"
        fi
    done
}

# Check disk space
check_disk_space() {
    echo -e "${BLUE}Checking disk space...${NC}"
    df_output=$(df -h / | tail -1)
    used_percent=$(echo $df_output | awk '{print $5}' | sed 's/%//')
    
    if [ "$used_percent" -gt 90 ]; then
        echo -e "${RED}✗ Disk usage is high: ${used_percent}%${NC}"
        echo "Clean up: docker system prune -a --volumes"
    elif [ "$used_percent" -gt 80 ]; then
        echo -e "${YELLOW}⚠ Disk usage: ${used_percent}%${NC}"
    else
        echo -e "${GREEN}✓ Disk usage: ${used_percent}%${NC}"
    fi
    
    echo "$df_output"
}

# Check memory
check_memory() {
    echo -e "${BLUE}Checking memory usage...${NC}"
    free -h
    
    available_mem=$(free -m | awk 'NR==2{print $7}')
    
    if [ "$available_mem" -lt 500 ]; then
        echo -e "${YELLOW}⚠ Low memory available: ${available_mem}MB${NC}"
    else
        echo -e "${GREEN}✓ Memory available: ${available_mem}MB${NC}"
    fi
}

# Check network connectivity
check_network() {
    echo -e "${BLUE}Checking network connectivity...${NC}"
    
    if curl -s --max-time 5 http://localhost:3334/api/health > /dev/null; then
        echo -e "${GREEN}✓ API is responding${NC}"
    else
        echo -e "${RED}✗ API is not responding${NC}"
        echo "Check if client-api container is running"
    fi
}

# Check ports
check_ports() {
    echo -e "${BLUE}Checking required ports...${NC}"
    
    ports=(3334 5432 19092 6379 9000 10200 2700)
    port_names=("API" "PostgreSQL" "Kafka" "Redis" "MinIO" "TTS" "ASR")
    
    for i in "${!ports[@]}"; do
        port=${ports[$i]}
        name=${port_names[$i]}
        
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            echo -e "${GREEN}✓ Port $port ($name) is in use${NC}"
        elif netstat -tuln 2>/dev/null | grep -q ":$port "; then
            echo -e "${GREEN}✓ Port $port ($name) is in use${NC}"
        else
            echo -e "${YELLOW}⚠ Port $port ($name) is not in use${NC}"
        fi
    done
}

# Run all checks
run_all_checks() {
    echo ""
    check_docker || true
    echo ""
    check_docker_compose || true
    echo ""
    check_env_file || true
    echo ""
    check_images || true
    echo ""
    check_containers || true
    echo ""
    check_disk_space || true
    echo ""
    check_memory || true
    echo ""
    check_ports || true
    echo ""
    check_network || true
    echo ""
    check_logs || true
    echo ""
    echo -e "${GREEN}Troubleshooting complete!${NC}"
}

# Main menu
show_menu() {
    echo ""
    echo "Select an option:"
    echo "1) Run all checks"
    echo "2) Check Docker installation"
    echo "3) Check containers"
    echo "4) Check logs"
    echo "5) Check disk space"
    echo "6) Check memory"
    echo "7) Check network"
    echo "8) Check ports"
    echo "0) Exit"
    echo ""
}

# Main execution
if [ "$1" == "--all" ] || [ "$1" == "-a" ]; then
    run_all_checks
    exit 0
fi

while true; do
    show_menu
    read -p "Enter choice: " choice
    
    case $choice in
        1) run_all_checks ;;
        2) check_docker ;;
        3) check_containers ;;
        4) check_logs ;;
        5) check_disk_space ;;
        6) check_memory ;;
        7) check_network ;;
        8) check_ports ;;
        0) echo "Goodbye!"; exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done
