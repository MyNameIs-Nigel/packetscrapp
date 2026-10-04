# Parallel delivery plan

Status: D0 and D1 contracts plus the E0 harness are merged. The [2026-10-04 gate audit](PROGRESS.md) records accepted source revisions, E0 verification, the Q0 review package, and remaining gates. G0 is ready for prerequisite review; G1 still needs E1 implementation and independent Q1 evidence. No gameplay or infrastructure has been verified. This plan coordinates three teams; it does not approve a release.

## Outcome and scope

Ship a keyboard-first, 2–5-player browser free-for-all at `packetscr.app`: harvest scrap, protect a core, fight after the Belt drops, and finish through sudden death. A solo visitor gets one clearly labelled bot. Use the existing TypeScript/npm workspace, Canvas 2D, plain DOM, Vite, authoritative Colyseus, and in-memory regional-server design.

Accounts, persistence, progression, teams, chat, touch controls, sound, and live match migration remain outside the October scope. Do not add engines, art pipelines, databases, or services to fill those gaps. Validate dependency versions and hosting assumptions during implementation.

**Decision:** organize delivery by independently reviewable work packages and shared gates, rather than completing one team's entire roadmap before the next starts. **Why:** Design can settle the next rules while Engineering builds an accepted contract and QA validates the previous increment.

## Team plans and authority

| Team | Plan | Owns | Required collaboration |
|---|---|---|---|
| Design | [Design phases](design/README.md), D0–D5 | Rules, maps, balance, fiction, interaction specifications, playtest interpretation | Engineering confirms feasibility; QA makes acceptance observable |
| Engineering / Programming | [Engineering phases](engineer/README.md), E0–E7 | Simulation, client, transport, bot, build/release infrastructure, instrumentation | Design reviews intended behavior; QA independently verifies integrated behavior |
| QA | [QA phases](qa/README.md), Q0–Q6 and [acceptance matrix](qa/ACCEPTANCE_MATRIX.md) | Traceability, adversarial scenarios, independent verification, defect triage, release evidence | Starts with specification review; does not wait for the game to be finished |

The maintainer coordinates scope and owns infrastructure access, credentials, release approval, and incidents until named owners replace them. Each issue needs one accountable person, even when several teams contribute. QA can block a gate on unmet acceptance criteria; it cannot silently redefine a rule. Design accepts rule changes; Engineering accepts technical contracts; the maintainer resolves schedule/scope conflicts without treating unverified work as passed.

## How work moves

1. Select a work package from a team phase and create an issue using the record below. Target one or two working days per package as an initial sizing heuristic, not a deadline. Split larger packages by observable behavior.
2. Link the exact prerequisite artifact or issue and its accepted commit. A whole phase need not finish when only one accepted artifact is required.
3. Design, Engineering, and QA agree on the behavior and failure examples before implementation of that behavior. Foundations, test planning, wireframes, and infrastructure preparation can proceed independently.
4. Integrate one small change through a team branch and PR. Engineering supplies developer tests; QA prepares cases in parallel and validates the resulting candidate. Use fixtures for preparation, then real clients and deployed services for acceptance.
5. Record evidence against an exact SHA, contract revision, environment, and configuration. Close a gate only when every listed exit criterion has evidence. Carry unresolved failures as issues; do not convert missing evidence into a pass.

Use issue states **Ready**, **In progress**, **In review**, **Verified**, or **Blocked**. A blocked issue names the missing artifact, owner, and next action. Limit each contributor to one primary package in progress; blocked work should move to an independent package, not create a chain of speculative implementations.

### Work-package / handoff record

Copy this into each issue or PR description. The existing contribution and release checks still apply.

```text
Team and phase ID:
Owner and reviewing teams:
Player or operational outcome:
In scope / explicitly deferred:
Source contract and accepted revision:
Prerequisite issue or artifact (or none):
Deliverables and suggested PR slices:
Acceptance IDs and Given / When / Then examples:
Verification layer, command/procedure, and expected result:
Evidence: full SHA, config/seed, environment, date, results, links:
Unresolved decisions / defects / next owner:
Status and next checkpoint:
```

**Decision:** keep the existing topical documents authoritative and link to them from phase records. **Why:** copying rules into three roadmaps would let teams implement different games. Design decisions update [GAME_DESIGN.md](GAME_DESIGN.md) and [VISION.md](VISION.md); technical changes update [ARCHITECTURE.md](ARCHITECTURE.md), [STACK.md](STACK.md), and the operational documents. Phase acceptance and tests change in the same reviewed change. Future `shared/config.ts` owns implemented numeric values; documentation explains intent and evidence records the configuration used.

## Dependency and overlap map

IDs refer to headings in the team plans. These are partial-order dependencies, not a serial queue.

| Work stream | Can start with | Accepted input needed before dependent implementation or verification |
|---|---|---|
| Contract and test planning: D0, Q0 | Existing documentation | None; Engineering participates in feasibility review |
| Foundation: E0 | Existing stack and command contract | D0 only for game-specific contracts; tooling need not wait |
| Join/movement: D1, E1, Q1 | D1 drafts and Q1 cases during E0 | E1 uses E0 and accepted D1 movement/map contract; Q1 runtime uses E1 |
| Delivery: E2, Q5 preparation | Provisioning/access planning during E0 | E2 application deployment uses E0 artifacts and E1 health/join; Q5 drills use E2 services |
| Harvest/build: D1, E3, Q2 | Economy design and tests before E1 finishes | E3 uses E1 and accepted D1 economy; death/respawn slice also needs D2's accepted build-phase rules; Q2 runtime uses E3 |
| Combat: D2, E4, Q3 | D2/Q3 planning during E3 | E4 uses E3 and accepted D2 lifecycle; Q3 runtime uses E4 |
| Sessions/bot: D3, E5, Q4 | D3 during E3; E5 lobby/reconnect slices after E1 | E5 bot and replay need E4 and accepted D3; Q4 runtime follows each slice |
| Regions/spectators: D3, E6, Q4/Q5 | Region fixtures and UI shell after E1/E2 | E6 regional rollout uses E2; spectator behavior uses E4/D3 |
| Playtests: D4 | Paper reviews after D1; playable rounds after E3/E4 | Full-game tuning uses E4/E5 and Q3/Q4 critical checks |
| Release: D5, E7, Q6 | Evidence collection starts with each earlier gate | Closure requires all launch gates and the exact release candidate |

For example, while E3 builds harvesting, Design can resolve D2 combat edges, QA can verify E1 joins, and Engineering's delivery work can progress in E2. E5 private-lobby work need not wait for E4 combat. Each slice still obeys its own listed inputs.

## Shared checkpoints

Current states, evidence and owners are in [PROGRESS.md](PROGRESS.md#shared-gates). The [E1 handoff](engineer/E1_HANDOFF.md) and [Q0/Q1 catalog](qa/Q0_Q1_PLAN.md) make the next slices reviewable under [#13](https://github.com/MyNameIs-Nigel/packetscrapp/issues/13) and executable under [#14](https://github.com/MyNameIs-Nigel/packetscrapp/issues/14). The criteria below remain the gate definitions.

| Gate | Measurable checkpoint | Evidence / sign-off |
|---|---|---|
| G0 — Contracts ready | D0 scope and Q0 matrix exist; every immediate implementation ambiguity has an owner and deadline; each first slice has accepted examples | Design, Engineering, QA review the first issue set |
| G1 — Connected foundation | E0/E1 and Q1 pass: two independent clients share server-owned movement; capacity, malformed input, metadata, and cleanup checks pass | Exact local candidate and transport traces; Design approves control behavior |
| G2 — Development delivery | E2 and initial Q5 delivery checks pass: the same candidate serves over HTTPS/WSS in isolated development; a failed rollout restores a working prior version | Maintainer access/configuration record and QA development evidence; no public-release claim |
| G3 — Build loop | E3/Q2 pass for 2, 3, 4, and 5 participants; resource conservation, placement restrictions, hidden-state checks, and timer boundaries pass | Accepted D1 contract, rule/SDK/browser results, Design review |
| G4 — Complete match | E4/Q3 pass: battle, core loss, respawn eligibility, draw, bounded sudden death, and results resolve deterministically | Accepted D2 contract and reproducible full-match evidence |
| G5 — Complete player journeys | E5/E6 and Q4 pass: private/replay/solo flows, reconnect, spectators, and region selection work; D4 playtest acceptance passes | Design playtest report plus QA journey and visibility results |
| G6 — Launch ready | D5/E7/Q5/Q6 pass: capacity, soak, alerts, drain, two-region release/rollback, cross-network smoke, and security checks are evidenced | QA recommendation, Design acceptance, Engineering readiness, maintainer approval |

G2 and G3 can finish in either order. G4 does not wait for G2 locally, but G6 requires both. A gate pass is tied to a candidate; later changes rerun impacted checks and the final release smoke suite. Passing a team phase never waives another team's gate.

## October planning windows

These windows replace the serial weekly task allocation in the original vision. They are targets, not promises; team capacity and access are unverified.

| Window | Design | Engineering | QA | Target checkpoints |
|---|---|---|---|---|
| Oct 3–10 | D0, D1; begin D2 | E0/E1; start E2 provisioning and delivery | Q0/Q1; Q2 cases; Q5 delivery cases | G0/G1; G2 if access is ready |
| Oct 11–17 | D2/D3; early D4 build-loop review | E3; finish E2; start independent E5 lobby slices | Q2; ongoing Q1 regression; Q5 restore checks | G2/G3 |
| Oct 18–24 | D4 full-match studies; D3 revisions | E4/E5; E6 region and spectator integration | Q3/Q4; Q5 load and failover work | G4; begin G5 |
| Oct 25–31 | D4 tuning and D5 acceptance | E6 completion; E7 hardening and release preparation | Q4/Q5 closure; Q6 candidate qualification | G5/G6 when evidence passes |

**Decision:** week one targets a reachable development prototype; production waits for G6. **Why:** [DEPLOYMENT.md](DEPLOYMENT.md) already requires release validation, draining, smoke tests, and rollback. The original week-one public-release aspiration cannot bypass those requirements. Deploy early to expose hosting problems; do not describe a moving-ships prototype as the finished public game.

If a gate slips, keep independent streams running and publish the blocker and revised forecast. Defer optional polish first. Removing a documented feature or changing a rule requires a Design/Engineering/QA impact review and maintainer scope decision; otherwise move the launch date. Never remove authority, hidden-state protection, environment isolation, or rollback to meet a date.

## Decisions to close before implementation

Defaults in the [documentation index](README.md) remain proposals until reviewed. Record each resolution, reason, examples, owner, and contract revision in its source document.

| Decision / ambiguity | Owner and checkpoint | What must be made testable |
|---|---|---|
| Ten-second entry pillar versus 15-second lobby | Design, D0 | Separate start-page interaction time from actual solo match start; measure the existing 20-second solo goal and explicitly resolve the ten-second wording |
| Deposit density, seed rules, starting scrap, odd-player map fairness | Design, D1 | Exact generation invariants and resource budget for every player count; reachability and build-phase isolation |
| Collision, facing/stop, Belt crossing shots, legal build tiles, radius metric, allied wall/shot behavior | Design + Engineering, D1 | Explicit movement/target/placement and boundary examples; do not infer from rendering |
| Tick boundaries, pending respawns, elimination after disconnect/core loss, simultaneous kills | Design + Engineering, D2 | Eligible contenders versus currently visible ships; deterministic tick order and draw resolution |
| Sudden-death duration | Design, D2 | Prove a finite match bound for every layout; starting dimensions and 3-second rings may exceed six minutes, so approve changed values or a revised promise |
| Hull upgrade healing, turret targeting/occlusion/ties, scrap pickup collisions | Design, D2 | Deterministic outcomes and economy invariants |
| Private-host departure, bot insertion control, reconnect identity, spectator waiting/disposal | Design + Engineering, D3 | Legal role/state transitions; current five-message list does not specify how a host adds a bot |
| Hidden build state versus other-player core markers | Design + Engineering, D1/D3 | Exact public metadata and per-role state views without revealing enemy layouts |
| Full-region default, Atlanta Tunnel and approved pulls, New York SSH | Engineering + maintainer, E2/E6 | Confirm index defaults, access and budget, failure modes, protocol/version policy; QA verifies |
| Capacity and performance budgets | Engineering + QA, Q0/E7 | Workload, hardware, numerical thresholds, and measured safe room limit before launch |

## Branches and integration

Every team branch starts with its assigned prefix and a short lowercase, hyphen-separated summary:

| Team | Pattern | Example |
|---|---|---|
| Design | `design/summary-of-branch` | `design/build-economy-contract` |
| Engineering / Programming | `engineer/summary-of-branch` | `engineer/authoritative-movement` |
| QA | `qa/summary-of-branch` | `qa/reconnect-boundary-cases` |

Create short-lived team branches from current `main`, merge through reviewed PRs with required checks, and refresh after shared contracts land. Use the owning team's prefix for cross-team work. Avoid permanent team branches and unrelated changes in one PR. These conventions are documented policy, not an installed branch-name check.

For this planning task only, the overseeing documentation change is committed and pushed to the user's current `docs/phases` branch. It does not rename that branch, merge to `main`, or publish a release. Future team work follows the prefixes above and [CONTRIBUTING.md](../CONTRIBUTING.md).
