# Q0 baseline and Q1 case catalog

Status: Q0 preparation complete for review under [#13](https://github.com/MyNameIs-Nigel/packetscrapp/issues/13). Q1 E0 audit results are in [PROGRESS.md](../PROGRESS.md); E1 runtime cases are Ready for implementation under [#14](https://github.com/MyNameIs-Nigel/packetscrapp/issues/14), with execution blocked until the slice exists. A Ready case is not a Pass. The [matrix](ACCEPTANCE_MATRIX.md) preserves the full launch scope.

## Accountability and evidence

@MyNameIs-Nigel is the accountable maintainer for all unassigned packages and reviewer selection. Codex authored this audit and the new fixtures; acceptance of those changes requires another reviewer. The original E0 implementation was independently exercised by this audit. Contract acceptance already recorded in PRs #3/#4 is retained; this audit does not invent additional reviewers or approvals.

| Responsibility | Owner / next checkpoint | Tracking |
|---|---|---|
| D0 scope and D1 rules | Design, maintainer coordinates; accepted first-slice revisions in #3/#4 | A01–A05; #13/#14 |
| Foundation and real transport fixtures | Engineering, maintainer coordinates; new fixture changes reviewed before E1 integration | A12/A14; #8/#13 |
| E1 independent execution and control review | QA and Design; maintainer assigns reviewers before #14 verification | A02/A04/A11/A12/A14; #14 |
| Later rules, journeys and playtests | Design/Engineering/QA per existing phase plan; maintainer assigns at each slice freeze | A01/A03/A05–A10; G3–G5 |
| Development access, capacity and alerts | Maintainer supplies access, Engineering implements, QA verifies on actual hosts | A11/A13/A14; E2/Q5/E7 |
| Final recommendation and incidents | QA recommends; maintainer owns release approval and incidents until reassigned | Q6/G6 |

Keep one record per case: case ID, full candidate SHA and clean/dirty status, accepted source revision, config revision, seed and join order, environment, runtime/browser versions, fixture and exact procedure, expected/actual result, sanitized evidence link, executor and reviewer, date, state, defect/next owner. Later changes invalidate affected evidence. Do not collect tokens, player-identifying logs, or real user data.

## Fixtures and execution environment

- Use Node 24.21.0/npm 11.19.0 and a clean detached checkout for acceptance. E0 local tests are transport/configuration tests, not game-rule acceptance.
- Seeds `0`, `1`, `42` cover each of 2/3/4/5 players; `4294967295` covers the seed boundary. Record seat join order. `createSeededRandom` pins Mulberry32 revision 1; `ManualClock` advances exact boundary tests without sleeping. Test invalid seeds separately.
- SDK servers bind `127.0.0.1` on an ephemeral port; close clients in `finally`, close the server, and assert room/timer/counter cleanup. Build regression tests use a disposable Git fixture and never mutate another suite's build output.
- Browser suites build the candidate, start their own servers on 2567/5173, and use independent contexts with fresh storage. Stop `npm run dev` first. Capture traces/screenshots on failure with tokens and names redacted.
- Initial E1 acceptance requires built Chromium, Firefox and WebKit on supported CI/local platforms, with browser/version limitations recorded and assigned before G1 review. The existing E0 command is Chromium-only. Do not report E0 Chromium coverage as the future E1 browser matrix.
- Local timing cases have an explicit loopback/no-added-delay network profile. Product timing and separate-device completion require two actual devices/networks later at Q4; they are not measured by this E0 audit. Record latency/loss and synchronized monotonic events for D0 button/lobby/build measures before quoting product timings.
- Q5 uses the existing provisional [performance profile](README.md#initial-operational-acceptance-profile): 15 Hz; tick p95 ≤40 ms/p99 ≤50 ms; event-loop p99 <20 ms; steady CPU <80%; RSS ≥20% below service limit; 60-minute churn/soak with post-cleanup baseline within 10%. Workload includes five seats and ten watchers per admitted room. The default 20-room/512 MB combination remains unmeasured and cannot pass G6.

## Q1 observable cases

All E1 expectations below derive from accepted D1 plus the proposed [technical handoff](../engineer/E1_HANDOFF.md). Review technical choices in #13 before implementing them. Fixture execution validates the relevant layer only; real SDK and browser evidence remain required where named.

| Case / IDs | Procedure and independent expected result | Layer / current readiness |
|---|---|---|
| F01 / A14 | Clean install, format/lint/types, unit/SDK/browser tests, repeated builds, bare-bundle join. Full SHA/toolchain/environment/digests match; no workspace dependencies beside bundle. | E0 commands; audit evidence available. |
| F02 / A12/A14 | Start bare bundle with missing settings, invalid port, or a valid but wrong runtime environment. Each exits nonzero promptly with the correct diagnostic and no listener. | Bare-process smoke automated in #13. |
| F03 / A14 | Seed obsolete files in both output directories, rebuild same inputs, compare complete manifests and confirm stale paths removed. Dirty non-local builds and wrong toolchains fail clearly. | Build regression automated in #13; command rejection procedure retained. |
| J01 / A02/A12 | Join 2, 3, 4, then 5 independently authenticated seats in the same room; attempt seat 6. Identity comes from server, roster/room agrees; rejection does not allocate or replace a seat. | Real SDK; Ready, runtime Blocked on E1. |
| J02 / A02/A12 | Empty/control-only/17-code-point name, NFC accents, HTML-like text, supplied seat ID, wrong protocol/environment. Names follow handoff; invalid/version-mismatched joins fail before mutation; rendering uses text. | SDK and built browser; Ready. |
| M01 / A02 | Advance ticks 1, 2, 3, 4 with a held direction, then stop; inspect both clients. One tile on even ticks only; cardinal intent persists; stop/facing follows D1. | Pure rule + SDK + two browser contexts; Ready. |
| M02 / A02 | Attempt world-edge exit, swap, same-destination moves, moving into a ship's starting tile, core/deposit/turret/enemy wall and owned wall. Expect D1 rejections/owner pass; blocked moves preserve facing/intent. | Pure rule and SDK fixtures; Ready. |
| M03 / A02/A03 | Enumerate seeds/player counts and join orders; assert exact dimensions, core/spawn offsets, valid unowned slots and Belt coordinates from D1. Seed/join-order replay reproduces assignment. | Pure fixture and serialized map inspection; Ready. Full resource A03 waits for Q2. |
| K01 / A02 | WASD/arrows, W then D then release D then W, repeat-key events, Tab, input typing, blur/hidden document, reconnect/disconnect. Check authoritative movement and emitted stop; no sticky keys, background actions or page-scroll capture outside the surface. | Built browsers, independent contexts; Ready. Reconnect recovery waits for E5. |
| V01 / A04/A12 | Use local build-view fixture with unique enemy/unowned sentinels. Inspect initial serialized state and subsequent patches for every seat; only own sector entities plus allowed roster/map metadata appear. Late join/view creation cannot leak. Apply battle-view fixture; all permitted entities appear then. | Real SDK received state; Ready. Actual build/lifecycle, spectators and reconnect wait for E3/E5/E6. |
| A01 / A12 | Submit unknown types, malformed/extra keys, forged position/health/scrap/identity, non-enum directions and invalid JSON. Authorized state/counters remain consistent, other client moves normally, no unhandled exception/private log payload. | Real WebSocket/SDK; Ready. |
| A02 / A12 | Exactly 30 then 31 frames in a one-second window; >60 in consecutive windows; oversized >1 KiB frame; boundary/reset and different clients. Validate drops, offender-only closure, fixed queue bounds, normal-client progress. | Real transport + injected monotonic time where possible; Ready. |
| H01 / A11/A14 | Fetch source and bare-built `/health`; verify status, region, full version/protocol/environment, uptime/counts/maxRooms/readiness, exact CORS and no-store. Fill capacity; process stays live with `accepting: false`; release rooms restores capacity. | Actual HTTP + SDK; Ready. Draining implementation waits for E7. |
| H02 / A11/A12 | Connect from accepted, wrong and absent browser origins, wrong environment/protocol, and above peer-connection cap. Only admitted policies succeed; ordinary SDK tests explicitly use local test policy. | HTTP/WebSocket boundary; Ready. TLS/proxy behavior waits for E2. |
| L01 / A02/A12 | Join/leave repeatedly; disconnect last client during queued input; inspect clients, room disposal, timers and health counts. No room survives empty waiting state; no prior identity/input reaches a new room. | Real SDK plus browser cleanup; Ready. Seat retention policy waits for E5. |

Cases A01/A02 here are local catalog IDs, not new matrix rows; retain both case and matrix IDs in reports. QA must compare the accepted rules to observed behavior and avoid expected values copied from current implementation outputs.

## G0 and G1 review

G0 review has D0/D1 accepted source artifacts, this Q0 coverage/ownership/fixture plan, initial issues #8/#13/#14, and named owners/checkpoints for later decisions. The new technical supplement and Q0 baseline need prerequisite-PR review before G0 is marked Verified. Numerical capacity targets remain provisional until target-host qualification.

For G1, run every applicable Q1 case against one immutable candidate, add Design's observed-control acceptance and independent QA results, and link the [E1 checklist](../engineer/E1_HANDOFF.md#completion-checklist). Passing F01–F03 completes only the E0 subset. G2 needs real development services; G3–G6 need their full gameplay, journey and operational evidence.
