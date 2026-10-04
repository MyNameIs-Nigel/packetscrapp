# Packet Scrapp

[![Repository checks](https://github.com/MyNameIs-Nigel/packetscrapp/actions/workflows/ci.yml/badge.svg)](https://github.com/MyNameIs-Nigel/packetscrapp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A space-themed multiplayer browser game for 2–5 players. Harvest scrap, fortify your core, and fight to be the last ship standing when the asteroid belt drops.

**Status: engineering foundation.** The npm workspaces, a Colyseus transport room, and a browser connection harness exist. Gameplay and deployment are not implemented; `packetscr.app` is the planned public site, and this is not yet a playable game.

The [development/gate audit](docs/PROGRESS.md) records accepted D0/D1 inputs and E0 evidence; the [E1 handoff](docs/engineer/E1_HANDOFF.md) and [Q0/Q1 case catalog](docs/qa/Q0_Q1_PLAN.md) define the next authoritative-movement milestone.

## Planned stack

TypeScript, Canvas 2D, Vite, and authoritative Colyseus servers. In production, a static client on Vercel connects to the New York game server over WebSockets; development runs the whole application on a self-hosted Atlanta host. Matches live in memory; no accounts or database are planned.

## Get involved

Start with the [documentation index](docs/README.md), [game design](docs/GAME_DESIGN.md), and [contributing guide](CONTRIBUTING.md). Small, tested changes with clear acceptance criteria are welcome.

Development is planned across three concurrent teams: [Design](docs/design/README.md), [Engineering / Programming](docs/engineer/README.md), and [QA](docs/qa/README.md). The [delivery plan](docs/DELIVERY_PLAN.md) defines small work packages, dependencies, and measurable shared checkpoints. Team branches use `design/summary-of-branch`, `engineer/summary-of-branch`, and `qa/summary-of-branch` respectively. These plans are not completed milestones.

To run the connection harness, use Node 24.21.0 and npm 11.19.0:

```sh
git clone https://github.com/MyNameIs-Nigel/packetscrapp.git
cd packetscrapp
python3 scripts/check_docs.py
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`, then choose **Connect**. For the full local checks:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run smoke:artifact
git diff --check
```

`test:e2e` builds its own local artifact and needs Playwright Chromium (`npx playwright install chromium`). `smoke:artifact` uses that build, starts the server bundle in an empty temporary directory, and requires the pinned Node version.

## Delivery model

| Change | Target |
|---|---|
| Pull request | Validation only; no deployment credentials |
| Push to `main` | After CI passes, the Atlanta host builds and deploys it to **development** (planned) |
| Published stable GitHub Release, e.g. `v0.3.0` | Validate the tag, build on GitHub, approve, and deploy to **production**: New York server, then Vercel client (planned) |

See [deployment and GitHub setup](docs/DEPLOYMENT.md), [testing and coding practices](docs/ENGINEERING.md), and the [operations runbook](docs/OPERATIONS.md). Repository and application checks run in CI; deployment remains planned.

## Community

- [Report a bug or suggest an improvement](https://github.com/MyNameIs-Nigel/packetscrapp/issues/new/choose)
- [Security reporting](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

Released under the [MIT License](LICENSE).
