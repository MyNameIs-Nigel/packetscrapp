# QA team phases

Status: the [Q0 baseline and Q1 catalog](Q0_Q1_PLAN.md) have an independent [supplement review](Q0_REVIEW.md). The [gate audit](../PROGRESS.md) records independent E0 foundation checks and original CI evidence; E1 gameplay, later QA phases, and full acceptance rows remain unverified. Branches use `qa/summary-of-branch`. Start with the [parallel plan](../DELIVERY_PLAN.md), [acceptance matrix](ACCEPTANCE_MATRIX.md), and existing [testing practices](../ENGINEERING.md).

## Responsibility and verification policy

Ensure implemented behavior matches accepted Design contracts, expose failures, and provide independent release evidence. Engineering owns developer tests and fixes; QA owns specification review, risk coverage, exploratory testing, independent integrated checks, and verification of fixes. No test suite can prove a game is free of all bugs.

**Decision:** prepare tests alongside design and implementation, then run them at each usable increment. **Why:** waiting for feature completion would discover contradictory rules, inaccessible UI, hidden-state leaks, and deployment problems too late. Q5 operational preparation starts with E2, even while Q2–Q4 gameplay checks are in progress.

Track every matrix row as **Planned**, **Ready**, **Running**, **Pass**, **Fail**, or **Blocked**. A fixture or mock can qualify test preparation, not the real transport or deployed service. A visual hidden-sector check cannot establish network privacy. Record exact candidate SHA, contract revision, config/seed, environment, browser/runtime versions, steps, expected/actual results, and sanitized artifacts. Missing access/build/evidence is Blocked, never Pass.

## Q0 — Testable contracts and coverage baseline

**Entry:** existing specs; run immediately alongside D0/E0.

Small work packages:

1. Review rules and map them to [A01–A14](ACCEPTANCE_MATRIX.md). Turn ambiguities from the shared decision table into Design/Engineering issues before the dependent implementation begins. Write independent expected outcomes for boundary and negative cases.
2. Define deterministic fixture requirements, seed/config capture, real SDK test isolation, built-client browser setup, separate-device/cross-network sessions, and cleanup/artifact redaction with Engineering.
3. Agree on browser/OS coverage and operational budgets before measurements. Start with Chromium, Firefox, and WebKit where supported; record exact versions and any platform limitation rather than silently skipping a browser.
4. Create the issue/evidence format and defect policy below. Assign owners for development access, test data, scenario automation, playtests, and release recommendation.

**Deliverables:** matrix with issue links and owners, boundary-case catalog, environment/test-data plan, agreed performance profile, and critical path cases ready for E1.

**Exit / checkpoint:** every in-scope behavior has a source contract, implementation phase, verification phase and layer; G0 decisions blocking E1 are resolved; QA can explain how every gate will be demonstrated. Planning closure is not a runtime pass.

### Initial operational acceptance profile

These are planning targets to confirm with Engineering before load testing, not measurements or proven host capacity. Changes require an explicit rationale before qualification, not thresholds lowered silently after a failure.

| Measure | Initial qualification criterion |
|---|---|
| Workload | Intended `MAX_ROOMS`, five players per room; include ten watchers on each room for a worst-case spectator run, or explicitly lower admitted capacity based on evidence |
| Tick work | Process-wide simulation work per 15 Hz cycle: p95 at most 40 ms, p99 at most 50 ms, leaving headroom within the 66.7 ms interval; also inspect per-room timing |
| Event loop / CPU | Event-loop delay p99 below 20 ms and sustained CPU below 80% of the allocated CPU during steady load |
| Memory | RSS stays below the configured service limit with at least 20% headroom; post-cleanup baseline at end of soak is within 10% of the warmed-up baseline, with no continuing upward trend |
| Soak | At least 60 minutes, repeated full match/disposal cycles and connection churn; zero crashes, unexplained disconnects, leaked rooms/timers, or mismatched outcomes |
| Connectivity | Record latency/packet-loss profiles and traffic volume; separately test slow consumers and loss/reconnect. Product timing samples report the profile used |
| Recovery | Health probing after drain respects the documented 60-second startup bound; all rollback components reach their previous SHA/protocol and pass a real join |

If budgets fail, reduce room admission, optimize, resize, or revise a justified target with all relevant reviewers, then rerun qualification. Do not treat the provisional 20-room, 512 MB proposal as acceptance evidence.

## Q1 — Foundation, authority, and reproducibility

**Entry:** prepare cases from E0/E1 contracts; execute on runnable E0/E1 artifacts.

Small work packages:

1. Reproduce installation/build/test commands from a clean checkout and launch the actual bundle without installed workspace dependencies. Verify toolchain/configuration errors, manifest identity, and CI checks.
2. Exercise two through five independent clients, seat overflow, movement/facing/collision, disconnect cleanup, and server-owned state. Inspect actual SDK traffic and authoritative snapshots rather than mocking room handlers.
3. Submit malformed/unknown/oversized messages, non-finite values, forged state/identity, wrong Origin, and action floods in isolation. Confirm bounded rejection without cross-client state changes, process failure, or leaked private data.
4. Verify `/health` metadata, no-store/CORS, and readiness versus liveness. Check keyboard input/focus in the built client and establish a visibility regression case as views appear.

**Exit / checkpoint:** the E0/E1 subsets of A02/A04/A11/A12/A14 pass against the same candidate; no critical authority or connection defect remains; G1 evidence includes real clients and browsers. Private sessions, complete spectator views, release qualification, and other later cases remain planned. Update cases as later message types are added.

**Handoff and overlap:** send reproducible defects to Engineering immediately; release E1 evidence for E3/E5. Q2 preparation and Q5 delivery verification can run while non-blocking foundation issues are fixed.

## Q2 — Map, economy, and build isolation

**Entry:** accepted D1 contracts and E3 slices, plus D2's build-phase death/respawn contract for those cases. Begin case design before code lands.

Small work packages:

1. Exercise at least three fixed seeds for each 2/3/4/5-participant layout, plus randomized property checks for generation invariants. Verify ownership, reachability, resource budgets, unowned sectors, and Belt edges against approved examples.
2. Test deposit last-hit payout, no regeneration, atomic purchase/deduction, insufficient funds, upgrade caps, overlapping requests, radius edges, occupied tiles, and owner/enemy wall behavior. Check scrap conservation through Belt death and pickups.
3. Inspect serialized state for every player and an unauthorized watcher before the Belt drop, at the boundary, and after reveal. Test reconnect view initialization when available, not just already-connected clients.
4. Review the build HUD and keyboard hints with Design. Verify phase clock, scrap/health, prices, feedback, and controls against D1 rather than treating a screenshot as rule evidence.

**Exit / checkpoint:** A03/A05 and the E3 player-visibility subset of A04 pass across the four player counts, including transport privacy; G3 passes with Design's build-loop review. Full spectator/reconnect visibility is qualified in Q4 as those roles arrive. Any unresolved generation or economy rule returns to Design instead of being encoded as the implementation's current output.

**Handoff and overlap:** Q3 gets known seeds and clean build-state fixtures; D4 gets a build-loop review candidate. Continue regression while E4 adds combat.

## Q3 — Combat, contenders, and match termination

**Entry:** accepted D2 lifecycle and E4 slices; draft edge cases during E3.

Small work packages:

1. Test beam/structure/core ordering, range/cooldown boundaries, turret occlusion/nearest-target ties, simultaneous damage and pickups, and upgrade behavior across deaths.
2. Exercise living ships, pending respawns, destroyed cores, disconnect expiry, and permanent elimination in combinations. Verify no early win while another eligible contender can respawn and no resurrection after eligibility is lost.
3. Step explicit ticks immediately before/at/after phase transitions and shrinking-Belt rings. Test same-tick final deaths and draws, no-action matches, enclosed cores, and all ships absent with a valid respawn pending.
4. Run full matches for every supported layout, verify the documented duration bound, agreement on results, disposal, and no lingering sockets/timers. Use accelerated clocks for boundary tests and at least one real-time full match for each layout.

**Exit / checkpoint:** A06/A07 pass; all four layouts terminate within D2's approved bound; no stuck room, wrong winner, or invalid respawn remains. G4 passes only with integrated real-client match evidence as well as deterministic tests.

**Handoff and overlap:** Design gets a full-game playtest candidate and known limitations; Q4 can use trusted ending/replay fixtures while E5/E6 finish.

## Q4 — Journeys, bot, reconnect, and spectators

**Entry:** accepted D3 flows. Prepare all cases early; run independent lobby/reconnect slices after E5 supplies them and full journeys after E4–E6 integrate.

Small work packages:

1. Verify Quick Play lobby timing, immediate five-player start, locking, private links, host permissions/departure, invalid nicknames, stale/full rooms, Play Again, and keyboard focus through recovery paths.
2. Verify the single labelled bot starts solo play within the agreed 20-second window, uses visible state and legal action validation, can harvest/spend/attack, and handles blocked paths. Inspect server action evidence; apparent fairness in a browser is insufficient.
3. Test reconnect just before/at/after the 20-second boundary, wrong or expired identity, ship damage while absent, core loss during absence, token handling, region retention, and cleanup. Validate the exact boundary rule agreed by D3.
4. Test waiting/build/battle/eliminated spectator roles, serialized-state restrictions, gameplay-action rejection, ten-spectator admission and eleventh rejection, room listings, and results disposal. Confirm watchers never consume player seats.
5. Run complete built-client journeys on Chromium/Firefox/WebKit where supported, plus two separate devices/networks; test region UI using Q5's scenarios. Assist Design's D4 sample and record confusion separately from reproducible software defects.

**Exit / checkpoint:** A01/A08–A11 journey cases pass; D4's playtest sample and comprehension/timing acceptance have actual evidence; no critical keyboard, role, reconnect, or visibility defect remains. G5 requires Design acceptance and E5/E6 integration, not just a suite of mocked flows.

**Handoff and overlap:** deliver the browser/device matrix, playtest evidence, and prioritized defects. Q5 operations proceeds independently; Q6 consumes both sets of results.

## Q5 — Delivery, capacity, and operational resilience

**Entry:** plan failure cases during E0/E2. Initial execution uses E2's development services; full drain/load/region qualification uses E4/E6/E7. This phase deliberately spans the schedule.

Small work packages:

1. Verify environment isolation, TLS/WSS, exact SHA/protocol manifests, runtime-only bundles, least-privilege paths, secret-free fork CI, and that main cannot mutate production. Review privileged workflow boundaries in addition to happy-path smoke.
2. Inject bad digests, wrong channels, failed downloads/restarts/health, stale/concurrent jobs, invalid/prerelease/non-main tags, and failed client promotion. Confirm sequential regional rollout, environment locks, approved-pointer ordering, rollback, retained artifacts, and no unauthorized promotion.
3. Test all region conditions: timeout, full, draining, wrong protocol/environment, restored primary, both down, saved manual preference, private-room region, and Tunnel lobby/active WebSockets. Verify priority selection and no live migration or environment crossover.
4. Load and soak the intended hardware against Q0's profile. Capture tick/event-loop/RSS/CPU/network/disconnect trends, including watcher fanout, slow consumers, churn, and post-room cleanup. Recommend an evidenced capacity, not a guessed one.
5. Exercise bounded drain, timeout expiry, region failure and coordinated restore in isolated development; validate old/new protocol handling and client refresh/maintenance behavior. Test external alerts for failure/readiness, version mismatch, and certificate-expiry thresholds using controlled fixtures where needed. Verify alert destination receipt and incident owner access.

**Exit / checkpoint:** initial E2 delivery subset closes G2; complete A11–A14 coverage and all operational budgets close Q5 for G6. Record restored client/server/channel identities and successful joins after rollback. No destructive test runs on public servers; production verification uses the existing dedicated synthetic-room policy.

**Handoff:** provide Engineering/maintainer workload, safe `MAX_ROOMS`, hardware/configuration, alert receipts, failure/restore evidence, and remaining operational risks. Repeat impacted drills after changes to deployment tooling or limits.

## Q6 — Release qualification and regression baseline

**Entry:** G1–G5, full Q5, D5/E7 candidate records, and an immutable release candidate. Preparation and evidence aggregation start earlier.

Small work packages:

1. Audit the matrix: every acceptance row has passing current evidence or a clearly identified non-blocking limitation. Check dependencies, contract/config revisions, critical defect closure, and retest scope after the last change.
2. Run the full [development release smoke](../ENGINEERING.md) for the exact candidate: metadata, two-player completed private match, Quick Play/bot, hidden-state and input checks, reconnect, regional drain, rollback and restore. Confirm capacity evidence still applies and execute the environment-specific production-client build checks.
3. Publish a concise recommendation naming SHA/artifact digests, Design acceptance, Engineering readiness, browser/network coverage, unresolved defects, rollback target, protocol plan, and monitoring owner. Any candidate change triggers affected regression plus final smoke before approval.
4. After maintainer-authorized release, verify public metadata and a dedicated synthetic join, then record deployed identities and cleanup. Report a failed rollout as failed and support rollback; never infer success from a published GitHub Release.

**Exit / checkpoint:** zero open blocker/critical defects; every G6 criterion has reviewed evidence; other limitations have an owner and explicit maintainer disposition. QA recommends go/no-go, and the maintainer remains release approver. Final launch evidence follows actual promotion, not this planning document.

## Defects, disagreements, and retesting

| Severity | Examples | Gate treatment |
|---|---|---|
| Blocker | Cannot build/join/finish; unauthorized state mutation; secret or hidden-sector disclosure; production isolation/rollback failure | Blocks the affected gate and release until fixed and retested |
| Critical | Wrong winner, duplication/economy corruption, common reconnect failure, required browser journey unusable, unstable approved capacity | Blocks affected feature acceptance and release |
| Major | Recoverable UI/flow failure with a documented workaround, outside a hard acceptance requirement | Owner and retest required; release deferral needs Design/Engineering/QA impact review and explicit maintainer disposition |
| Minor | Cosmetic or low-impact polish with no rules/accessibility/authority impact | May be deferred with an issue and owner |

Every failed hard acceptance criterion blocks its gate regardless of the severity label. A specification ambiguity is a decision issue, not permission to call current code correct. Capture expected/actual behavior, minimal reproduction, SHA/config/seed, environment, sanitized logs/trace, severity rationale, and the source acceptance ID. Engineering fixes on its own branch with a regression test; QA reproduces the original case on the fix and checks adjacent risks; Design reviews intentional rule changes. Do not close a defect solely because a PR merged.

At each shared checkpoint, report passes, failures, blockers, and the next needed artifact. Evidence links and issue status carry progress between teams; a calendar date or test count alone never demonstrates readiness.
