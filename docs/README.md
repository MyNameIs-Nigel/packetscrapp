# Packet Scrapp docs

Packet Scrapp is a planned space-themed multiplayer browser game targeting `packetscr.app`. D0/D1 contracts and the E0 connection harness are merged; the [current gate audit](PROGRESS.md) records evidence, prerequisite work, and the next E1 package. Game rules, player journeys, and live infrastructure remain unverified and unimplemented.

## Reading order

| Doc | Covers |
|---|---|
| [VISION.md](VISION.md) | What the game is, the design pillars, non-goals, and October targets |
| [DELIVERY_PLAN.md](DELIVERY_PLAN.md) | Parallel work streams, cross-team dependencies, shared gates, decision owners, branch conventions |
| [PROGRESS.md](PROGRESS.md) | Dated implementation audit, accepted revisions, exact evidence, gate states and next owners |
| [E1 implementation handoff](engineer/E1_HANDOFF.md) | Prerequisite artifacts, deterministic/input/health decisions, PR slices and G1 checklist |
| [Q0/Q1 baseline and cases](qa/Q0_Q1_PLAN.md) | Owners, fixtures, browser/network plan, independent expected results and evidence format |
| [Q0 supplement review](qa/Q0_REVIEW.md) / [sector pin recheck](qa/Q1_SECTOR_PIN_RECHECK.md) | Independent QA reading of E1 technical oracles and #21 assignment vectors |
| [Design phases](design/README.md) | D0–D5: scope, rule/map/UI contracts, balance studies, player acceptance |
| [Engineering / Programming phases](engineer/README.md) | E0–E7: foundation, simulation, delivery, player journeys, release readiness |
| [QA phases](qa/README.md) | Q0–Q6: specification review, independent verification, operational qualification |
| [QA acceptance matrix](qa/ACCEPTANCE_MATRIX.md) | Stable acceptance IDs linking requirements, team phases, test layers, and gates |
| [GAME_DESIGN.md](GAME_DESIGN.md) | Rules, phases, economy, controls, the bot, spectators, starting numbers |
| [STACK.md](STACK.md) | Languages, packages, hosting, and repo layout |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Client/server model, tick loop, room lifecycle, anti-cheat |
| [REGIONS_AND_HEALTH.md](REGIONS_AND_HEALTH.md) | Server regions, health checks, failover, the region picker |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Environment isolation, GitHub setup, release gates, DNS, rollback |
| [ENGINEERING.md](ENGINEERING.md) | Testing procedures, coding practices, quality gates |
| [OPERATIONS.md](OPERATIONS.md) | Monitoring, incidents, capacity, recovery |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contributor workflow and definition of done |

## Conventions

- **Every decision carries its reason.** Decisions are written as a choice followed by "Why". If the reason stops being true, the decision is open again.
- **Numbers are starting values.** Every gameplay number lives in `shared/config.ts` and is expected to change after playtests. The docs describe intent; once implemented, the config file is the source of truth.
- **Behaviour, not API calls.** These docs describe what the system does. Check exact Colyseus API names against the docs for the pinned version before writing code.
- **Parallel work, explicit handoffs.** Use the team phase plans and shared gates; the source specifications remain authoritative. Phase numbers do not require all teams to advance in lockstep.
- **Team branch names.** Use `design/summary-of-branch`, `engineer/summary-of-branch`, or `qa/summary-of-branch`. See [CONTRIBUTING.md](../CONTRIBUTING.md) for examples and integration policy.

## Open decisions

These were initially filled in with defaults. D1 has accepted harvesting by shooting; the [gate audit](PROGRESS.md#decision-ownership-and-next-checkpoints) distinguishes accepted contracts from later unresolved choices. Operational defaults remain proposals until their implementation checkpoint review.

The [delivery decision register](DELIVERY_PLAN.md) assigns owners and checkpoints for these defaults and the additional rule ambiguities found during phase planning. Acceptance of a roadmap does not silently resolve those gameplay choices.

| # | Decision | Default in these docs | Where |
|---|---|---|---|
| 1 | Does a full server count as unavailable for automatic region selection? | Yes, so overflow spills to the next region when one exists | REGIONS_AND_HEALTH |
| 2 | How does the Atlanta development host accept traffic from a home network? | Cloudflare Tunnel | REGIONS_AND_HEALTH, DEPLOYMENT |
| 3 | How does the Atlanta development host receive deploys? | It pulls each green `main` commit, builds it, and deploys it in place | DEPLOYMENT |
| 4 | How does the New York production server receive deploys? | A GitHub-hosted release workflow builds the bundle and pushes it over SSH | DEPLOYMENT |
| 5 | Harvest by shooting deposits, or by bumping into them? | Shooting | GAME_DESIGN |
| 6 | What does sudden death do? | Cores shatter and the Belt closes in | GAME_DESIGN |
| 7 | Does unspent scrap drop on death? | Yes, all of it | GAME_DESIGN |

The [MIT License](../LICENSE) is adopted. The deployment environment and release policy in [DEPLOYMENT.md](DEPLOYMENT.md) supersedes the original push-to-public-site proposal.
