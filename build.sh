#!/bin/bash

# Build script for Bounce Analyser Webapp
# This script builds Docker images for both backend and frontend

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Building Bounce Analyser Webapp Docker Images${NC}"

# Get the repository root directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Build backend
echo -e "${GREEN}Building backend...${NC}"
docker build \
  -f bounce_analyser_webapp/Dockerfile.backend \
  -t bounce-analyser-backend:latest \
  .

# Build frontend
echo -e "${GREEN}Building frontend...${NC}"
docker build \
  -f bounce_analyser_webapp/Dockerfile.frontend \
  -t bounce-analyser-frontend:latest \
  bounce_analyser_webapp/app/frontend

echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "Images created:"
echo "  - bounce-analyser-backend:latest"
echo "  - bounce-analyser-frontend:latest"
echo ""
echo "To run locally with docker-compose:"
echo "  cd bounce_analyser_webapp && docker-compose up"

