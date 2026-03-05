# Research Summary: Schweisstal Bingo - Deployment and Testing Infrastructure

**Domain:** CI/CD, testing, and deployment infrastructure for a real-time multiplayer web app
**Researched:** 2026-03-05
**Overall confidence:** HIGH

## Executive Summary

The Schweisstal Bingo project has a functional React + Express + Socket.io app that needs production-grade infrastructure: automated testing, CI/CD pipeline, Docker improvements, and public access via Cloudflare Tunnel. All of these are well-trodden paths with mature tooling.

The testing strategy splits into two runners: Vitest for the server (Socket.io event testing, Express route testing) and Jest via react-scripts for the client (React component tests). This avoids a CRA-to-Vite migration while giving the server modern, fast tooling. The official Socket.io documentation provides first-class Vitest examples, making the integration straightforward.

The CI/CD pipeline follows the existing portfolio project pattern: GitHub Actions on a self-hosted runner, building Docker images directly on the home lab server. No container registry needed -- the runner IS the deployment target. Version bumping uses simple `npm version patch` rather than semantic-release, appropriate for a private app.

The Cloudflare Tunnel configuration is trivial: add one ingress rule mapping `bingo.922-studio.com` to `localhost:3923` in the existing cloudflared config. The Docker setup needs minor fixes: update Node 18 to Node 20, consolidate to a single process (serve React build from Express), and fix port mapping to 3923.

## Key Findings

**Stack:** Vitest (server tests) + Jest/CRA (client tests) + GitHub Actions (self-hosted) + Docker Compose + cloudflared
**Architecture:** Single Docker container, Express serves both API and static React build, single port (3923)
**Critical pitfall:** The Dockerfile runs two processes via shell `&` -- must consolidate to single Express process before adding health checks or proper container lifecycle management.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Docker and Server Fixes** - Fix Dockerfile (single process, Node 20, correct port), update docker-compose.yml
   - Addresses: Port 3923 mapping, Node EOL, process management
   - Avoids: Building CI/CD on a broken Docker setup

2. **Bug Fixes** - Fix win condition, round logic, generateGrid mutation, host-only controls
   - Addresses: Core game functionality
   - Avoids: Writing tests against buggy behavior that will change

3. **Test Suite** - Add Vitest for server, Jest for client, test critical paths
   - Addresses: Test coverage requirement
   - Avoids: Deploying untested bug fixes

4. **CI/CD Pipeline** - GitHub Actions workflow with test + deploy + Discord notify
   - Addresses: Automated deployment
   - Avoids: Manual deployment process

5. **Cloudflare Tunnel** - Add ingress rule, verify public access
   - Addresses: Public accessibility at bingo.922-studio.com
   - Avoids: Nothing blocks this, but it's the final "go live" step

**Phase ordering rationale:**
- Docker must be fixed first because CI/CD deploys via Docker
- Bugs should be fixed before writing tests (tests should verify correct behavior)
- Tests must exist before CI/CD pipeline (pipeline runs tests)
- Cloudflare Tunnel is independent but logically last (public access after everything works)

**Research flags for phases:**
- Phase 1 (Docker): Standard patterns, no research needed
- Phase 2 (Bugs): Needs codebase analysis, not external research
- Phase 3 (Tests): Socket.io testing patterns well-documented, low risk
- Phase 4 (CI/CD): May need to check 922-Studio/workflows for reusable workflow compatibility
- Phase 5 (Tunnel): Trivial config change, no research needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools are mature, well-documented, widely used |
| Features | HIGH | Clear requirements in PROJECT.md, standard infrastructure patterns |
| Architecture | HIGH | Single-container Express app is the simplest correct approach |
| Pitfalls | MEDIUM | Docker dual-process is a known issue; CI/CD on self-hosted runners has edge cases around cleanup |

## Gaps to Address

- Whether `922-Studio/workflows` org has reusable workflows that fit this project's private repo context
- Exact cloudflared config file location on the home lab server (likely `/etc/cloudflared/config.yml` or `~/.cloudflared/config.yml`)
- Whether a CNAME for `bingo.922-studio.com` already exists in Cloudflare DNS
- Server's Docker Compose version (v1 vs v2 CLI syntax: `docker-compose` vs `docker compose`)
