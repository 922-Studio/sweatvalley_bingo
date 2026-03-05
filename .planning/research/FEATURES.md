# Feature Landscape

**Domain:** CI/CD, testing, and deployment infrastructure for real-time multiplayer bingo
**Researched:** 2026-03-05

## Table Stakes

Features that are expected for a production deployment pipeline.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Automated test suite | Can't deploy with confidence without tests | Medium | Split: Vitest (server) + Jest (client via CRA) |
| CI pipeline (test + deploy) | Catch regressions before deploy | Low | GitHub Actions, self-hosted runner |
| Automated deployment | Manual SSH + docker compose is error-prone | Low | Self-hosted runner IS the server |
| Docker health check | Container restart on failure | Low | Single `curl` check on Express |
| Version tracking | Know what's deployed | Low | `npm version patch` in CI |
| Public HTTPS access | Users need to reach it | Low | Cloudflare Tunnel handles SSL |
| Deployment notifications | Know when deploys succeed/fail | Low | Discord webhook, matches portfolio |
| Single-process Docker | Reliable container lifecycle | Low | Express serves static + API on one port |

## Differentiators

Not strictly required, but valuable for this project's context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Socket.io integration tests | Real-time features are the core -- test them with real connections | Medium | Official patterns exist, connect real client to test server |
| Cancel-previous-run in CI | Fast pushes don't queue builds on the self-hosted runner | Low | One action step with concurrency group |
| Health check endpoint | Docker healthcheck + CI deploy verification + monitoring | Low | Express `/health` returning JSON status |

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| E2E browser tests (Playwright/Cypress) | Overkill for a classroom bingo game, high maintenance cost | Unit + integration tests cover the critical paths |
| Container registry (Docker Hub/GHCR) | Single server, no multi-environment deployment | Build on the runner, which IS the server |
| Kubernetes / Docker Swarm | Single container, single server | Docker Compose is sufficient |
| Load testing | Max ~30 concurrent players (one classroom) | Manual testing is fine at this scale |
| Staging environment | One server, one use case | Deploy to production directly (low-stakes app) |
| semantic-release / changelogs | Private app, no consumers of changelog | Simple `npm version patch` |
| CRA-to-Vite migration | Out of scope, not needed for this milestone | Use react-scripts as-is for client tests |
| Separate cloudflared container | Already running as systemd service on host | Add ingress rule to existing config |

## Feature Dependencies

```
Docker fix (single process, port 3923) --> CI/CD pipeline (CI deploys via Docker)
Bug fixes --> Test suite (tests verify correct behavior)
Test suite --> CI/CD pipeline (pipeline runs tests)
CI/CD pipeline --> Cloudflare Tunnel (deploy before going public)
Server refactor (extract game.js) --> Server tests (need importable modules)
```

## MVP Recommendation

Prioritize:
1. Docker single-process fix + port 3923 (foundation for everything else)
2. Bug fixes (correct behavior to test against)
3. Server-side Socket.io tests with Vitest (highest value -- tests the core real-time logic)
4. CI/CD pipeline with deploy step
5. Cloudflare Tunnel ingress rule

Defer:
- Client-side React component tests: Lower value. The UI is simple. Server-side Socket.io event handling is where bugs live.
- Reconnection handling tests: Depends on implementing reconnection logic first (listed as Active requirement).

## Sources

- [Socket.IO Official Testing Guide](https://socket.io/docs/v4/testing/)
- [GitHub Actions Self-Hosted Runners](https://docs.github.com/actions/hosting-your-own-runners)
- [Cloudflare Tunnel Configuration](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
