# Schweisstal Bingo

## What This Is

A classroom observation bingo game where students mark squares when they spot characteristic teacher behaviors (scratching head, speaking Bavarian, using catchphrases, etc.). Players join via game code, each gets a unique randomized grid, and scores sync in real-time. Built with React + Express/Socket.io, deployed via Docker on a home lab server accessible at `bingo.922-studio.com`.

## Core Value

Multiple players can join and play bingo together in real-time with zero friction — share code, join, play.

## Requirements

### Validated

- ✓ Multiplayer lobby (create game, share code, join) — existing
- ✓ Real-time score sync via Socket.io — existing
- ✓ Individual randomized grids per player — existing
- ✓ 3x3 and 4x4 grid sizes — existing
- ✓ Word difficulty distribution (schwer/mittel/leicht) — existing
- ✓ Docker containerization — existing

### Active

- [ ] Fix win condition: classic bingo (first complete row/column/diagonal wins)
- [ ] Fix "Runde beenden" button: host-only
- [ ] Fix round logic: support configurable number of rounds (not hardcoded to 1)
- [ ] Fix client/server round mismatch (client hardcodes max:10, server max:1)
- [ ] Fix generateGrid array mutation bug
- [ ] Remove unused axios dependency
- [ ] GitHub repo under private user account
- [ ] GitHub Actions CI/CD pipeline (like portfolio: versioning, tests, deploy, Discord notify)
- [ ] Deploy script for Docker Compose on home lab server
- [ ] Cloudflare Tunnel entry for bingo.922-studio.com
- [ ] Accessible locally at home-lab:3923
- [ ] Test suite (unit + integration tests)
- [ ] Player reconnection handling (restore game state on disconnect/reconnect)

### Out of Scope

- Mobile native app — web-first, responsive CSS sufficient
- Persistent game history / database — in-memory games fine for use case
- User accounts / authentication — anonymous play with game codes
- Custom word lists via UI — CSV file editing sufficient
- Traefik/Nginx reverse proxy — using Cloudflare Tunnel instead

## Context

- **Existing codebase:** Functional React 18 + Express 4.18 + Socket.io 4.5.4 app with known bugs
- **Server:** Ubuntu home lab (`home-lab`), self-hosted GitHub Actions runner at `/home/lab/actions-runner/`
- **Deployment pattern:** Git push → GitHub Actions → self-hosted runner → Docker Compose rebuild
- **Domain routing:** Cloudflare Tunnel (`cloudflared`) maps subdomains to localhost ports
- **Current tunnel config:** `gregor.922-studio.com` → `:3922`, `922-studio.com` → `:8010`
- **CI pattern from portfolio:** cancel-previous → version bump → test → deploy → Discord notify
- **Reusable workflows:** `922-Studio/workflows` org has shared CI/CD workflows
- **Server schedule:** Auto-boots 05:00, shuts down 22:00 (CET)

## Constraints

- **Tech stack**: React + Express + Socket.io (keep existing stack, no migration)
- **Deployment**: Docker Compose on home lab server, Cloudflare Tunnel for public access
- **Port**: 3923 on host (next to portfolio on 3922)
- **GitHub**: Private repo under personal user account (not 922-Studio org)
- **Runner**: Uses 922-Studio self-hosted runner for CI/CD
- **No reverse proxy**: Cloudflare handles SSL termination and routing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Classic bingo win condition | More fun than "mark everything" | — Pending |
| Cloudflare Tunnel (not Traefik/Caddy) | Already running on server, handles SSL | — Pending |
| Port 3923 | Sequential after portfolio (3922) | — Pending |
| Private GitHub repo | User preference, not org project | — Pending |
| Keep Socket.io stack | Already works, no reason to migrate | — Pending |

---
*Last updated: 2026-03-05 after initialization*
