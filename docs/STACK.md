# Stack

The E0 workspace now pins Node 24.21.0, npm 11.19.0, Vite, Colyseus 0.18 components, the SDK, and test tools. Gameplay and deployment choices below are still plans. Validate hosting pricing and capacity during implementation.

## Overview

A static canvas client talks over `wss://` to Colyseus game servers, one per region. In production, Vercel serves the client and a New York droplet runs the server. Development runs the whole application on a self-hosted Atlanta container. Everything is TypeScript in one public GitHub repo.

## Choices and reasons

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One language across client, server, and shared rules. Message and state types are written once, so the two sides cannot drift apart. |
| Repo | Public GitHub monorepo with npm workspaces | The client, server, and shared code change together and deploy from the same commit. npm workspaces need no extra tooling. |
| Client build | Vite | The client is a single page with a render loop. Vite builds it to plain static files with almost no configuration. |
| Rendering | Canvas 2D, drawn with simple shapes | A top-down grid of ships, blocks, and beams needs nothing more. There is no art pipeline to maintain and no rendering library to learn in a one-month build. |
| UI framework | None | The start page is a nickname field, two buttons, a match list, and a region picker. Plain DOM code handles that without adding React to the bundle. |
| Client hosting | Vercel for production; Caddy on the Atlanta host for development | Vercel serves static files from a CDN, and a GitHub-gated release workflow deploys to it. It never carries game traffic, so its WebSocket limits do not apply. Development serves its client next to its server so one host holds the whole environment. |
| Game server | Node 24.21.0 with Colyseus 0.18 | Rooms, the 5-player cap, matchmaking, reconnection, and per-client state filtering are built in. Writing those by hand on plain `ws` would use up much of the month. |
| WebSocket transport | Colyseus default (`ws`) | It is pure JavaScript, so the server bundles into one file. The faster uWebSockets transport is a native module and would complicate builds for speed this game does not need. |
| Bot | Server-side, inside the room | The bot calls the same action functions a human's messages do. It needs no extra process or connection. |
| Persistence | None | There are no accounts or scores to store. Match state lives in memory and is gone when the match ends. |
| Message validation | Hand-written type guards in `shared/` | There are five small message types. A validation library would be a dependency for very little code. |
| Tests | Vitest plus real SDK integration and Playwright browser tests | Rules, transport, visibility, and player flows require different test layers; see [ENGINEERING.md](ENGINEERING.md). |
| Server bundling | esbuild | It bundles the server and its dependencies into one JavaScript file, so no server ever runs `npm install`. That matters on a machine with 512 MB of RAM. |
| New York host | DigitalOcean droplet: 1 vCPU, 512 MB, Ubuntu LTS | The production game server. It runs only the prebuilt bundle and never builds. Capacity is a hypothesis subject to load testing. |
| Atlanta host | Self-hosted Ubuntu CT container | The whole development environment at no extra cost. It has spare compute, so it builds development candidates itself. |
| Process manager | systemd | It is already on Ubuntu, restarts the server after a crash or reboot, and uses no extra memory. |
| TLS on the droplet | Caddy reverse proxy | `.app` domains are HTTPS-only in browsers, so every hostname needs a certificate. Caddy obtains and renews one automatically. |
| DNS | Cloudflare | Free, fast to update, and it also provides the tunnel used by the Atlanta host. |
| CI/CD | GitHub Actions on GitHub-hosted runners, plus a pull-based builder on the Atlanta host | CI checks every change and builds production releases. The Atlanta host pulls and builds green `main` commits itself. There is no self-hosted runner: on a public repo, a fork's pull request could use it to run code on the host. |
| Health monitoring | A `/health` endpoint on each server | The client uses it to pick a region, deploys use it to confirm a release, and an uptime monitor uses it to raise alerts. |
| License | MIT | The simplest permissive license. |

## Packages

| Workspace | Packages |
|---|---|
| `server` | `@colyseus/core`, `@colyseus/ws-transport`, `@colyseus/schema` |
| `client` | `@colyseus/sdk` |
| Dev tooling | `typescript`, `vite`, `esbuild`, `vitest`, `tsx` |

**Why so few:** every dependency is code to audit and keep up to date. A short list is also easier for contributors to an open-source project to follow.

E0 uses the focused Colyseus core and WebSocket packages instead of the `colyseus` umbrella package, which also installs unused auth, monitoring, playground, and Redis modules. Server/core 0.18.18, transport 0.18.4, schema 5.0.36, and SDK 0.18.5 are pinned and tested together.

**Version policy:** pin exact versions in `package.json` and commit the lockfile. Colyseus has not reached 1.0, so minor versions can change APIs. Use a documented compatible Colyseus server/schema/SDK set; package version numbers need not be identical. Test it end to end before upgrades.

## Planned repo layout

```
packet-scrapp/
  client/              Vite app: renderer, input, start page, region picker
  server/              Colyseus rooms, tick loop, bot, /health and /rooms
  shared/              Game rules, config, message types, region list
  deploy/              Caddyfile, systemd units, environment files, and the Atlanta development builder
  docs/                Source specifications and shared delivery plan
    design/            Design team phases and acceptance handoffs
    engineer/          Engineering / Programming team phases
    qa/                QA team phases and cross-team acceptance matrix
  .github/workflows/   CI and deploy
```

**Why the rules live in `shared/`:** the server runs them as the authority, the bot uses them to pick legal actions, the tests exercise them directly, and the client imports the same types and constants for drawing.

## What changed from the first proposal

- **Per-region hostnames replace `ws.packetscr.app`.** The servers are `nyc.packetscr.app` (production) and `atl-dev.packetscr.app` (development). *Why:* the region belongs in the hostname. Adding a region becomes one DNS record and one line in the region list.
- **Atlanta hosts development, not a second production region.** *Why:* it runs the whole development environment, and sharing it with production would share its failures. Production starts with New York alone.
- **The Atlanta host is reached through a Cloudflare Tunnel.** *Why:* it sits on a home network. A tunnel needs no port forwarding and keeps the home IP address private. See [REGIONS_AND_HEALTH.md](REGIONS_AND_HEALTH.md).
- **The Atlanta host pulls and builds its own updates.** *Why:* GitHub's runners cannot reach a machine on a home network over SSH, and the host has compute to spare. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Delivery and dependency maintenance

Main deploys only to development, built on the Atlanta host, once delivery exists. Published stable releases are built on GitHub-hosted runners and deploy to Vercel and New York through environment approval. See [DEPLOYMENT.md](DEPLOYMENT.md). The Node/npm toolchain, lockfile, CI, and npm Dependabot updates are configured. The E0 server bundle starts on pinned Node from an empty directory and accepts a real SDK client; repeat that check when runtime dependencies change.
