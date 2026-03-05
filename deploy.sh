#!/bin/bash
set -e

echo "=========================================="
echo "Deploying Sweatvalley Bingo"
echo "=========================================="
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

# Pull latest code unless SKIP_PULL is set
if [ "${SKIP_PULL}" != "true" ]; then
  echo "Pulling latest code..."
  git pull origin main
fi

echo "Stopping existing containers..."
docker compose down || true

echo "Building and starting containers..."
docker compose up -d --build

echo "Waiting for health check..."
sleep 5
if curl -fsS http://localhost:3923/health > /dev/null; then
  echo "Health check passed!"
else
  echo "Health check failed!"
  docker compose logs --tail=50
  exit 1
fi

echo "Cleaning up dangling images..."
docker image prune -f || true

echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
