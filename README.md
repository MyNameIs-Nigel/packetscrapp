# Packet Scrapp

[![Repository checks](https://github.com/MyNameIs-Nigel/packetscrapp/actions/workflows/ci.yml/badge.svg)](https://github.com/MyNameIs-Nigel/packetscrapp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A space-themed multiplayer browser game for 2–5 players. Harvest scrap, fortify your core, and fight to be the last ship standing when the asteroid belt drops.

**Status: design and repository foundation.** The game, npm workspaces, and deployment scripts are not implemented yet. `packetscr.app` is the planned public site; this repository does not yet provide a playable build.

## Planned stack

TypeScript, Canvas 2D, Vite, and authoritative Colyseus servers. A static client on Vercel connects to independent game regions over WebSockets. Matches live in memory; no accounts or database are planned.

## Get involved

Start with the [documentation index](docs/README.md), [game design](docs/GAME_DESIGN.md), and [contributing guide](CONTRIBUTING.md). Small, tested changes with clear acceptance criteria are welcome.

Development is planned across three concurrent teams: [Design](docs/design/README.md), [Engineering / Programming](docs/engineer/README.md), and [QA](docs/qa/README.md). The [delivery plan](docs/DELIVERY_PLAN.md) defines small work packages, dependencies, and measurable shared checkpoints. Team branches use `design/summary-of-branch`, `engineer/summary-of-branch`, and `qa/summary-of-branch` respectively. These plans are not completed milestones.

To check the current repository (Python 3.9+):

```sh
git clone https://github.com/MyNameIs-Nigel/packetscrapp.git
cd packetscrapp
python3 scripts/check_docs.py
git diff --check
```

Application setup commands will be added with the first runnable implementation.

## Delivery model

| Change | Target |
|---|---|
| Pull request | Validation only; no deployment credentials |
| Push to `main` | Build, test, and deploy to **development** (planned) |
| Published stable GitHub Release, e.g. `v0.3.0` | Validate the tag, approve, and deploy to **production** (planned) |

See [deployment and GitHub setup](docs/DEPLOYMENT.md), [testing and coding practices](docs/ENGINEERING.md), and the [operations runbook](docs/OPERATIONS.md). Only repository checks run today.

## Community

- [Report a bug or suggest an improvement](https://github.com/MyNameIs-Nigel/packetscrapp/issues/new/choose)
- [Security reporting](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

Released under the [MIT License](LICENSE).
