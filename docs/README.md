# Packet Scrapp docs

Packet Scrapp is a space-themed, top-down multiplayer browser game at `packetscr.app`, built during October 2026. These docs record what is being built and why each choice was made.

## Reading order

| Doc | Covers |
|---|---|
| [VISION.md](VISION.md) | What the game is, the design pillars, non-goals, and the October plan |
| [GAME_DESIGN.md](GAME_DESIGN.md) | Rules, phases, economy, controls, the bot, spectators, starting numbers |
| [STACK.md](STACK.md) | Languages, packages, hosting, and repo layout |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Client/server model, tick loop, room lifecycle, anti-cheat |
| [REGIONS_AND_HEALTH.md](REGIONS_AND_HEALTH.md) | Server regions, health checks, failover, the region picker |
| [DEPLOYMENT.md](DEPLOYMENT.md) | DNS, server setup, CI/CD, rollback |

## Conventions

- **Every decision carries its reason.** Decisions are written as a choice followed by "Why". If the reason stops being true, the decision is open again.
- **Numbers are starting values.** Every gameplay number lives in `shared/config.ts` and is expected to change after playtests. The docs describe intent; the config file is the source of truth.
- **Behaviour, not API calls.** These docs describe what the system does. Check exact Colyseus API names against the docs for the pinned version before writing code.

## Open decisions

These were filled in with a default so the docs are complete. Each one needs a yes or a change.

| # | Decision | Default in these docs | Where |
|---|---|---|---|
| 1 | Does a full server count as unavailable for automatic region selection? | Yes, so overflow spills to the next region | REGIONS_AND_HEALTH |
| 2 | How does the Atlanta node accept traffic from a home network? | Cloudflare Tunnel | REGIONS_AND_HEALTH, DEPLOYMENT |
| 3 | How does the Atlanta node receive deploys? | It pulls releases on a timer | DEPLOYMENT |
| 4 | Should New York also switch to pull-based deploys? | No, it keeps SSH push for now | DEPLOYMENT |
| 5 | Harvest by shooting deposits, or by bumping into them? | Shooting | GAME_DESIGN |
| 6 | What does sudden death do? | Cores shatter and the Belt closes in | GAME_DESIGN |
| 7 | Does unspent scrap drop on death? | Yes, all of it | GAME_DESIGN |
| 8 | License | MIT | STACK |
