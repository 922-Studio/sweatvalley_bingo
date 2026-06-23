#!/bin/bash
set -e

echo "Starting deployment..."
# Working directory is set by the CI runner (GITHUB_WORKSPACE checkout).
# No cd needed — the script already runs from the repository root.

# Clean up Docker build cache and unused images BEFORE building
# This prevents BuildKit cache corruption ("parent snapshot does not exist")
echo "Cleaning up Docker build cache and unused images..."
docker builder prune -f
docker image prune -f

# Build new images WHILE old containers are still running (zero-downtime)
echo "Building new images (existing services still running)..."
if ! docker compose build; then
  echo "Build failed, retrying with --no-cache..."
  docker builder prune -af
  docker compose build --no-cache
fi

# Swap: recreate only changed containers with the new images
echo "Swapping to new containers..."
docker compose up -d --wait --wait-timeout 120

# Show container status
echo "Deployment complete!"
echo ""
echo "Container status:"
docker compose ps

echo ""
echo "Recent logs:"
docker compose logs --tail=50
