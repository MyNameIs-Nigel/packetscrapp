# Testing and coding practices

## Status and quality standard

These are acceptance criteria for implementation. E0 adds a runnable workspace and application checks. They currently cover configuration, a transport-only room, a real SDK join, and a built-browser connection. Passing them does not mean gameplay or delivery works. Aim for small, verifiable changes and recoverable failures, not a promise of defect-free software.

Implementation is divided into [Engineering team phases](engineer/README.md), with independent [QA phases](qa/README.md) and [Design contracts](design/README.md). The [shared delivery plan](DELIVERY_PLAN.md) controls cross-team handoffs and gates; the [acceptance matrix](qa/ACCEPTANCE_MATRIX.md) links each requirement to its evidence. Engineering branches use `engineer/summary-of-branch`; QA branches use `qa/summary-of-branch`; Design branches use `design/summary-of-branch`.

## Developer feedback loop

1. Define observable acceptance criteria and failure cases before coding.
2. For a bug, reproduce it with a failing test. For a feature, test the rule or boundary before wiring it to the UI.
3. Implement the smallest coherent change and run focused tests while iterating.
4. Run the full required checks before opening a PR; review your diff for secrets, compatibility, and unrelated changes.
5. Verify browser behavior and operational changes in development. Record commands, versions, and results in the PR.

Current checks (Python 3.9+):

```sh
python3 scripts/check_docs.py
git diff --check
```

### Application command contract (E0 harness implemented)

Use root npm scripts so contributors and CI run the same commands. Pin Node and npm versions, exact direct dependency versions, and the workspace lockfile. CI installs with `npm ci`.

Use Node 24.21.0 and npm 11.19.0. `npm run dev` starts a local-only Colyseus transport room on `127.0.0.1:2567` and the Vite connection harness on `127.0.0.1:5173`. `npm run test:e2e` first builds local artifacts; install Chromium with `npx playwright install chromium`. Run `npm run smoke:artifact` after a build to verify digests and a real SDK join with the standalone server bundle on the pinned runtime. Non-local artifacts require `PACKET_BUILD_ENV=development` or `production` and a clean checkout. Runtime configuration uses `PACKET_ENV`, `PACKET_REGION`, `PACKET_HOST`, and `PACKET_PORT`; see [server/.env.example](../server/.env.example).

| Command | Required behavior |
|---|---|
| `npm run dev` | Start local client/server with local-only region configuration |
| `npm run format:check` | Check formatting without changing files |
| `npm run lint` | Static checks, including unsafe promises and imports |
| `npm run typecheck` | Strict TypeScript checks across all workspaces |
| `npm run test:unit` | Deterministic rule/configuration tests |
| `npm run test:integration` | Real server/SDK message and lifecycle tests |
| `npm run test:e2e` | Browser tests against the built client and test server |
| `npm run build` | Produce client/server bundles and version manifest |

## Test layers

| Layer | Cases that must be covered | Approach |
|---|---|---|
| Rules | Movement/collision, costs, cooldowns, Belt boundaries, deaths/respawn, core destruction, ties, sudden death | Pure functions, seeded random source, explicit simulated ticks |
| Input/security | Malformed/oversized messages, unknown actions, non-finite values, flood limits, non-host start, wrong origin | Untrusted inputs through the real message boundary |
| State visibility | Enemy sector absent during build, correct reveal, spectator restrictions | Inspect serialized state received by each real client, not just UI visibility |
| Lifecycle | 2–5 players, full room, join after lock, disconnect/reconnect expiry, empty-room cleanup | Real Colyseus clients and server on isolated ports |
| Regions | Timeout, wrong environment/protocol, full/draining region, saved-region fallback, room-link region | Controlled health fixtures plus real HTTP/CORS smoke checks |
| Browser | Quick Play, private join, keyboard focus/controls, bot game, result/replay, offline/reconnect messages | Independent browser contexts; verify Chromium, Firefox, and WebKit where supported |
| Delivery | Exact SHA, bad digest, failed restart, drain deadline, rollback, stale deployment, wrong channel/tag | Disposable development services and fault injection |

Unit tests use fake clocks; integration tests use bounded waits for observable state rather than arbitrary sleeps. Reset ports, rooms, timers, storage, and sockets between tests. Fail on uncaught exceptions or leaked processes. Capture random seeds, logs, screenshots, and traces for failed tests, with tokens and player identifiers removed.

The [Q0/Q1 catalog](qa/Q0_Q1_PLAN.md) pins E1 preparation: `createSeededRandom` implements Mulberry32 revision 1 with an unsigned 32-bit seed and independent reference vectors; `tests/fixtures/clock.ts` provides a manually advanced clock. Record algorithm/config revision and admitted join order for map replay. Seeded randomness is for simulation, never identity or credentials. The integration suite also rebuilds an isolated Git fixture after injecting stale output, and the bare-artifact smoke rejects missing/invalid/mismatched runtime settings.

Do not solve flaky tests by increasing retries until green. Track an owner and deadline for any temporary quarantine. Avoid snapshots that only mirror implementation and mocks that bypass the security boundary. Coverage is a signal: require meaningful tests for changed behavior and all critical rules; set numerical thresholds after establishing a real baseline.

## Browser and release smoke procedure

Run against development after deployment, using the candidate commit:

1. Verify client build metadata and every region's SHA, protocol, environment, TLS, and no-store health headers.
2. Open two independent browser contexts/devices, join the same private room, move/fire/build, and finish a match. Also verify Quick Play and the solo bot path.
3. Confirm hidden sectors are absent from received state, host-only start is enforced, and malformed messages do not crash the server.
4. Disconnect/reconnect within and beyond the allowed window. Confirm stale room links and unavailable regions show useful errors.
5. Drain one region, verify new joins use the other, and confirm existing matches complete within the drain bound. Do not perform disruption tests on production without a maintenance plan.
6. Roll back the candidate and verify the prior client/server versions work together, then restore the intended candidate.

Record release SHA, environment, browsers, pass/fail evidence, and known limitations. Production smoke tests should use a dedicated synthetic room and clean up immediately.

## Performance and resilience

Before public launch, load-test the intended server size up to `MAX_ROOMS` with five clients per room. Measure tick execution p95/p99, event-loop delay, RSS, CPU, disconnects, and network throughput. At 15 Hz the tick interval is about 66.7 ms: budget execution below that with headroom, and record the chosen capacity limit from measurements. Run a multi-match soak to detect leaks.

Test connection churn, slow consumers, oversized payloads, network loss, memory pressure, and unavailable regions in an isolated environment. Do not claim a 512 MB host can handle 20 rooms until measured. Adjust capacity or instance size before launch.

## Coding practices

- Enable strict TypeScript, including checked indexed access where practical. Use `unknown` at external boundaries and validate before narrowing; avoid unchecked `any` and assertions.
- Keep game rules pure and deterministic in `shared/`. Inject clock and randomness. Separate rendering, transport, simulation, and operations code.
- The server owns movement, economy, cooldowns, and permissions. Reject illegal state transitions and bound message sizes, queues, rates, and room counts.
- Keep protocol schemas and validation together. Increment `PROTOCOL_VERSION` for incompatible changes and add compatibility tests and a rollout plan.
- Fail startup on missing/invalid environment configuration. Never silently default production to local or development hosts.
- Handle async failures explicitly; bound network calls with timeouts and cancellation. Use bounded retry with backoff only for operations safe to repeat.
- Log structured events with commit, environment, region, and failure reason. Never log credentials, reconnection tokens, full player messages, or unnecessary personal data.
- Minimize dependencies, verify licenses and advisories, and document why each is needed. Changes to runtime, dependencies, workflows, or protocol need appropriate regression checks.
- Keep functions focused and names clear. Comment non-obvious invariants and tradeoffs. Update design docs when behavior changes.
- Make operational changes idempotent, least-privileged, observable, and reversible. Test the failure/rollback path, not only successful deployment.

## Merge and release gates

Pull requests require both repository and application checks; E0 implemented the root command suite and CI. Merges must not skip required tests. Release candidates also require development smoke, capacity evidence for relevant changes, protocol review, and a rollback target. See [CONTRIBUTING.md](../CONTRIBUTING.md), [DEPLOYMENT.md](DEPLOYMENT.md), and [OPERATIONS.md](OPERATIONS.md).
