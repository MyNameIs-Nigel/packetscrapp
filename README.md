# Packet Scrapp

[![Repository checks](https://github.com/MyNameIs-Nigel/packetscrapp/actions/workflows/ci.yml/badge.svg)](https://github.com/MyNameIs-Nigel/packetscrapp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A space-themed multiplayer browser game for 2–5 players. Harvest scrap, fortify your core, and fight to be the last ship standing when the asteroid belt drops.

**Status: verified connected foundation with a local harvest/build preview.** The authoritative server supplies admission, private sector views, bounded inputs and 15 Hz movement. Local preview rooms now generate finite deposits, award scrap, build walls/turrets, apply upgrades, handle Belt deaths/core-backed respawns, and reveal the map after 120 seconds. The preview pauses at reveal: turret/PvP combat, complete matches, bots, reconnect and deployment are still ahead. `packetscr.app` remains the planned public site.

Independent E1 repair retest and required three-browser CI are recorded in [QA PR #54](https://github.com/MyNameIs-Nigel/packetscrapp/pull/54). The new gameplay slice has its own [Engineering evidence and limits](docs/engineer/E3_BUILD_LOOP.md); independent Q2 and Design UI acceptance remain required before G3.

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

Open `http://127.0.0.1:5173`. To try the first build loop, open two independent browser tabs/contexts, enter nicknames, choose the same player count and map seed, then activate **Start harvest/build preview** in each. The room starts when all requested seats join. Focus the board: WASD/arrows move, Space harvests, 1/2 build wall/turret, Q/E upgrade blaster/hull. **Join waiting room** and **Start movement prototype** remain available separately. For the full local checks:

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
