#!/bin/bash
set -e

echo "Starting deployment..."
# Working directory is set by the CI runner (GITHUB_WORKSPACE checkout).
# No cd needed — the script already runs from the repository root.

# ── Load server routing (server-independent config) ────────────────────────
# Provides DEPLOY_DOCKER_HOST, ENV_SOURCE, REGISTRY_HOST.
# Falls back to known-good defaults if the file is absent (first-time setup).
if [ -f /home/lab/server-routing.env ]; then
  # shellcheck source=/dev/null
  . /home/lab/server-routing.env
  echo "Loaded server routing: DEPLOY_DOCKER_HOST=${DEPLOY_DOCKER_HOST}"
else
  echo "WARNING: /home/lab/server-routing.env not found — using defaults"
fi
: "${DEPLOY_DOCKER_HOST:=ssh://lab@astro-antares}"
: "${REGISTRY_HOST:=registry.922-studio.com}"

# ── PHASE 1: BUILD on the runner (DOCKER_HOST must be unset) ───────────────
# SAFETY: builds NEVER run against the production manager via DOCKER_HOST.
# Concurrent remote builds OOM'd antares on 2026-06-23 → hard reboot required.
if [ -n "${DOCKER_HOST:-}" ]; then
  echo "ERROR: DOCKER_HOST is set (${DOCKER_HOST}) — refusing to build. Builds must run locally." >&2
  exit 1
fi

echo "Phase 1: building image locally on runner (DOCKER_HOST unset)..."

# Pre-build cleanup to prevent BuildKit cache corruption
docker builder prune -f
docker image prune -f

if ! docker compose build; then
  echo "Build failed, retrying with --no-cache..."
  docker builder prune -af
  docker compose build --no-cache
fi

# ── PHASE 2: PUSH to registry ──────────────────────────────────────────────
echo "Phase 2: pushing image to ${REGISTRY_HOST}..."
docker compose push

# ── PHASE 3: DEPLOY on antares — PULL ONLY, no build ─────────────────────
echo "Phase 3: deploying on antares (pull + up, no build)..."

export DOCKER_HOST="${DEPLOY_DOCKER_HOST}"

# Ensure the state directory exists on antares before starting the container
ssh lab@astro-antares 'mkdir -p /home/lab/sweatvalley_bingo/state'

# Pull the freshly-pushed image
docker compose pull

# Start/update containers — --no-build enforces the invariant: antares never builds
docker compose up -d --no-build --wait --wait-timeout 120

# Show container status
echo ""
echo "Deployment complete!"
echo ""
echo "Container status:"
docker compose ps

echo ""
echo "Recent logs:"
docker compose logs --tail=50
