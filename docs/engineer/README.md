# Engineering / Programming team phases

Status: E0 is merged in PR #9; its original CI passed and the [gate audit](../PROGRESS.md) supplies independent foundation evidence and a build correction for review. E1 is implemented and In review: the [implementation record](E1_EVIDENCE.md) holds the candidate, results, decisions and limits, and the [E1 handoff](E1_HANDOFF.md) tracks the G1 checklist, which independent Q1 and Design review still have to close. E2–E7 remain planned. Nothing here is a playable game: there is a roster-only waiting room and a local movement prototype. Branches use `engineer/summary-of-branch`. Follow [shared gates and dependencies](../DELIVERY_PLAN.md), [engineering practices](../ENGINEERING.md), and the [QA acceptance matrix](../qa/ACCEPTANCE_MATRIX.md).

## Responsibility and implementation boundaries

Build the agreed game using TypeScript, npm workspaces, Canvas 2D/DOM, Vite, and authoritative Colyseus. Grid collision, instantaneous beams, and pure tick-based rules are the required simulation; a physics engine, 3D renderer, prediction system, persistent backend, and central matchmaker are unnecessary for this scope. Keep server authority and build-phase information filtering at the network boundary.

**Decision:** run gameplay and delivery as separate work streams within this team, sharing accepted artifacts and interfaces. **Why:** infrastructure access and deployment failures must surface before the full game exists. E2 can proceed beside E3/E4; E5 and E6 expose independently startable slices below.

Each numbered package below is a suggested small PR boundary, split further if it exceeds the one-to-two-day sizing target. Every PR includes developer tests, documentation changes, and the [handoff record](../DELIVERY_PLAN.md). QA validation supplements developer testing rather than replacing it. Validate pinned package APIs and runtime support when implementing; the stack documents are a plan, not installed dependencies.

## E0 — Reproducible workspace and test foundation

**Entry:** existing stack/command specification. Start immediately alongside D0/Q0; avoid inventing unsettled gameplay behavior.

Packages and deliverables:

1. Create `client`, `server`, and `shared` npm workspaces with exact dependency pins, a compatible Colyseus server/schema/SDK set, supported pinned Node/npm, lockfile, strict TypeScript, and example local configuration.
2. Implement the root command contract from [ENGINEERING.md](../ENGINEERING.md): local dev, formatting, lint, types, unit/integration/e2e tests, and reproducible builds. Introduce a minimal real SDK connection and built-browser test as their harnesses become runnable; document incomplete coverage rather than using passing no-op scripts.
3. Add CI for the commands without deployment credentials, shared deterministic clock/random interfaces, and manifest production with full SHA, protocol, toolchain, environment, and digests. Prove the server artifact starts on the pinned runtime without `node_modules`; account for any actual runtime assets.

**Exit / measurable check:** a clean checkout completes `npm ci` and all implemented required commands; a built client/server smoke works; CI and local commands agree; a repeated same-input build has explainable artifact identity; missing/invalid configuration fails clearly. Q1 verifies reproducibility for A12/A14.

**Handoff:** E1 consumes the runnable harness; E2 consumes the artifact/manifest contract; QA gets commands, isolated-port setup, cleanup procedure, and deterministic fixtures. G1 also needs E1/Q1.

## E1 — Authoritative connected-room slice

**Entry:** E0 and accepted D1 movement/map slice. QA drafts Q1 cases while E0 finishes.

Packages and deliverables:

1. Implement room creation, sanitized nicknames, seat limits, authoritative identity, basic waiting state, and cleanup. Define version/environment negotiation and bounded, validated message handling; do not trust client position, health, or scrap.
2. Implement the 15 Hz pure tick loop and legal tile movement, render simple ships with interpolation, and wire keyboard inputs with focus handling. Use D1 collision/facing/stop rules and deterministic seeds.
3. Add schema/view foundations and serialized-state tests for per-seat access before private sector data is introduced. Add public health metadata, readiness/capacity counters, no-store/CORS behavior, separate WebSocket Origin checks, and private structured logs.

**Exit / measurable check:** two independent SDK clients and two browser contexts see identical server-owned movement; five seats work and a sixth player is rejected; forged/malformed/rate-excess actions do not alter unauthorized state or crash the room; empty rooms dispose; health fields identify the candidate correctly. Q1 passes the E0/E1 subsets of A02/A04/A11/A12/A14; later features remain planned. This is G1, a connectivity prototype rather than a complete match.

**Handoff:** E3 gets simulation/actions/views; E2 gets the real health/join probe; E5 can start private-lobby and reconnect packages using accepted D3 slices.

## E2 — Isolated development delivery

**Entry:** infrastructure/access preparation can start during E0. Application deployment needs E0 artifacts and E1 health/join. The maintainer supplies host, DNS, Tunnel, credential, and budget access (Vercel is needed only for E7 production); record missing access as a blocker while gameplay continues.

Packages and deliverables:

1. Provision the Atlanta development host: pinned runtime, separate runtime/build/deploy users, least-privilege restart rule, Caddy, Cloudflare Tunnel routes for `dev.packetscr.app` and `atl-dev.packetscr.app`, environment files, and the development region allowlist. Keep secret values out of source, artifacts, chat, and logs.
2. Implement the pull-based development builder: select the newest `main` SHA whose required checks passed, build and smoke-test it as the unprivileged build user, verify digests, activate atomically, verify local and public health plus a synthetic join, and restore the previous release on failure. Hold a lock, never downgrade without an explicit rollback, and skip recorded failed SHAs.
3. Serve the development client from the same release with room-link rewrites, and post the `deploy/development` commit status for every result.
4. Prepare the New York production droplet (runtime only, Caddy, loopback port) and exercise the production bundle there. Add external probes and verify alert delivery.

**Exit / measurable check:** a validated main candidate reaches isolated `dev.packetscr.app` and `atl-dev.packetscr.app` over HTTPS/WSS; failed checks are never deployed; failed build, wrong digest, and failed restart cases restore the prior working version; main and fork PRs have no production mutation path; deployed health/client metadata agrees with the manifest. Initial Q5 delivery evidence closes G2. Match draining remains an E7/Q5 launch requirement after the lifecycle exists.

**Handoff:** QA gets development URLs, manifests, sanitized workflow results, restore evidence, and an access owner. E6 consumes the real development endpoint; E3/E4 need not wait for this stream. The production release workflow is completed under E7.

## E3 — Harvest and build loop

**Entry:** E1 plus accepted D1 map/economy contract; the death/respawn slice also needs D2's accepted build-phase rules. E2 may run concurrently.

Packages and deliverables:

1. Generate seeded maps for 2–5 participants with accepted resource/spawn invariants, private-sector views, unowned sectors, lethal Belt, and build clock.
2. Implement beam-based harvesting, finite deposits, authoritative last-hit payout, scrap totals and pickup rules needed for build-phase deaths. Add legal purchases/upgrades with exact atomic deductions and caps.
3. Implement walls, turret placement, radius/occupancy rules, core presence, build-phase death/respawn behavior, and build HUD/shop hints. Implement only accepted D1/D2 edge rules; unresolved respawn details block that slice, not map/harvest work.
4. Integrate build-to-battle transition and view reveal with boundary tests. Turret combat can be completed in E4; label that limitation on the intermediate build.

**Exit / measurable check:** deterministic tests and real-client checks pass at each player count; illegal purchases/placements leave state and scrap unchanged; harvesting pays exactly once; Belt death follows the accepted scrap/respawn rule; enemy sector data is absent from serialized state until the reveal boundary. Design reviews the build experience and Q2 closes G3 using A03–A05.

**Handoff:** E4 gets structures, resources, timers, and validated views; D4 can run build-loop reviews. Do not report a full playable game until combat/ending gates pass.

## E4 — Combat and bounded match completion

**Entry:** E3 plus accepted D2 combat/lifecycle contract.

Packages and deliverables:

1. Implement beam and turret target resolution, range/cooldown/damage rules, and stable ordering for simultaneous events. Keep all action validation on the server.
2. Implement core destruction, drops/pickups, permanent elimination, upgrades across respawns, and contender eligibility across pending respawn or disconnected states.
3. Implement sudden-death core shattering, shrinking Belt, draw/winner evaluation, results delivery, and bounded room disposal. Verify duration at every map size against D2's calculation.

**Exit / measurable check:** seeded unit and real SDK scenarios cover core loss during respawn, same-tick final deaths, no living ships with eligible respawns, phase-boundary damage, and shrinking-map elimination. Independent clients finish a full match and see the same result; all 2–5-player layouts end within the accepted bound. Q3 and Design review close G4 for A06/A07.

**Handoff:** E5 gets complete rules for bot/replay integration; E6 gets live/eliminated spectator lifecycle; D4 gets a candidate suitable for full-match studies.

## E5 — Private play, reconnect, bot, and replay

**Entry:** accepted D3 slices. Packages 1–2 can begin after E1; packages 3–4 require E4's complete lifecycle.

Packages and deliverables:

1. Implement Quick Play timing and locking, private room links with region, host-only start, host departure policy, and the accepted host bot-insertion contract. Validate participant limits and nickname errors through the actual transport.
2. Implement server-issued reconnect identity, `sessionStorage` handling, automatic reconnect to the same seat/region within 20 seconds, attacked-while-disconnected behavior, expiry, and clear recovery messages. Never expose tokens in logs or public state.
3. Implement one labelled server-side bot with the same visibility and validated action path as a human. Harvest, spend, navigate legal tiles, and attack after the Belt drops; test obstacle/stuck and no-resource cases without granting hidden-state access or special stats.
4. Integrate solo start, results/Play Again, returning to matchmaking, focus recovery, and stale/full/locked-room feedback. Verify storage, sockets, timers, and room counters reset correctly across repeated matches.

**Exit / measurable check:** solo Quick Play starts against one labelled bot within the accepted 20-second measurement; two humans can start a private game; a non-host cannot start/add a bot; bot count never exceeds one; reconnect before/after expiry follows D3; replay creates/joins a fresh valid match with no old-state leakage. Q4 passes A08/A09 and the applicable A02 cases; D4 can qualify the complete entry/replay journey.

**Handoff:** QA receives deterministic bot fixtures and replay/reconnect evidence. E6 may proceed beside these packages; G5 requires both E5 and E6 plus Design playtests.

## E6 — Regional selection and spectators

**Entry:** accepted D3 flows, E1 health, E2 regional development services, and E4 lifecycle for full spectator integration. Health fixtures and the picker shell can start before E2 completes.

Packages and deliverables:

1. Implement parallel two-second health probes, priority selection, 30-second start-page refresh and Quick Play recheck, saved/manual preference and fallback, full/draining exclusion, protocol/environment checks, and offline/retry behavior.
2. Implement region-bound private links without silently moving a join to another region; add room-list fetches for the selected region and protect against stale responses after selection changes.
3. Implement spectator admission/cap, build-only match metadata, post-Belt full view, and eliminated-player transition; reject all spectator gameplay actions and avoid counting watchers as player seats.
4. Verify public routes, the single-region offline notice and restore, and Tunnel lobby connections. Exercise multi-region failover with controlled endpoint fixtures; existing live matches remain on their original server and are lost if that server stops.

**Exit / measurable check:** Q4/Q5 pass A04/A10/A11 with real serialized views plus controlled endpoint failures; ten spectators fit and the eleventh is rejected; restored New York attracts only new joins; cross-environment endpoints are never selected. E5/E6/Q4 and D4 acceptance close G5.

**Handoff:** E7 gets the complete application with region selection ready for one or more regions; QA gets exact topology/version/configuration for capacity and recovery qualification.

## E7 — Capacity, recovery, and release candidate

**Entry:** E2–E6 accepted slices and D4 feedback. Prepare release workflow and instrumentation earlier; close only after integrated qualification.

Packages and deliverables:

1. Resolve Design/QA launch-blocking issues in focused PRs. Measure realistic full rooms and spectators on intended hardware, tune `MAX_ROOMS` or resize from evidence, and complete leak/churn/slow-client soak testing against agreed Q0 budgets.
2. Add bounded draining with `accepting: false`, a match-duration-based deadline, and a systemd stop timeout above that deadline. Test healthy drain, deadline expiry, startup failures, alerts, and coordinated rollback through the approved pointer.
3. Complete stable-release validation, exact main ancestry/CI/development-evidence checks, immutable artifact reuse, environment approval, sequential regional verification, and client promotion. Test prerelease/tag/stale/concurrent/failed-promotion rejection in development as specified in [DEPLOYMENT.md](../DEPLOYMENT.md).
4. Assemble the candidate manifest, previous server/client/channel targets, protocol compatibility or maintenance plan, incident owner, capacity report, and repeatable runbooks. Requalify any rebuilt or changed candidate.

**Exit / measurable check:** Q5 operational thresholds pass; Q6 full candidate smoke passes; D5 accepts the experience; no release-blocking defect remains; rollback artifacts and alert routes are verified. G6 permits the maintainer to approve and publish a stable release under the existing deployment policy. A candidate or published tag alone is not deployment success.

**Final handoff:** supply QA/maintainer exact artifact identities and recovery commands. After authorized promotion, verify public health and a dedicated synthetic join, record actual deployed versions, and monitor error/disconnect rates. On failure stop promotion and execute the approved rollback; do not declare launch complete.
