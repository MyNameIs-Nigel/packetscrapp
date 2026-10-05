# E1 implementation record

Status: **In review.** Engineering implemented E1.1 (admission), E1.2 (movement) and E1.3 (authority, views, health) in one branch for [#14](https://github.com/MyNameIs-Nigel/packetscrapp/issues/14). This is developer evidence from the implementing team. It is not independent Q1 execution, not Design control review, and G1 is **not** Verified. Contract sources are the [E1 handoff](E1_HANDOFF.md), [D1 movement/map revision 1](../GAME_DESIGN.md#d1-movement-and-map-contract--revision-1) and the [Q0/Q1 catalog](../qa/Q0_Q1_PLAN.md).

## Candidate and environment

| Item | Value |
|---|---|
| Implementation candidate | `d32adfc5ea08402ce070895fcf89828bc8702730` (clean tree; later documentation-only commits change no code) |
| Base | `main` at `5042235` (includes D2 proposal #30; it does not change the E1 movement contract) |
| Branch | `claude/vigilant-bardeen-wnttwl` |
| Date | 2026-10-05 |
| Runtime | Linux cloud container, Node 24.21.0 / npm 11.19.0 (the pinned toolchain), Python 3.11.15 |
| Browser | Chromium 141.0.7390.37 through `PACKET_CHROMIUM_EXECUTABLE` (the container's system build, not the Playwright-pinned revision) |
| Protocol / seeds | `PROTOCOL_VERSION` 2; seeds `0`, `1`, `42`, `4294967295` for every player count in the runtime seat-assignment cases; seed `42`, two players, for the browser journeys |

## Commands and actual results

All commands ran against the clean candidate above.

| Command | Result |
|---|---|
| `python3 scripts/check_docs.py`, `git diff --check` equivalent, phase-claim test | Passed |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Passed (strict TypeScript, now with `erasableSyntaxOnly`) |
| `npm run test:unit` | 190 tests in 10 files passed |
| `npm run test:integration` | 105 tests in 8 files passed (real Colyseus server and real SDK clients, plus a bundle test and the E0 build regression) |
| `npm run test:e2e -- --project=chromium` | 11 built-browser tests passed, repeated three times with identical results |
| `npm run build` twice, compare manifests | Identical manifests |
| `PACKET_BUILD_ENV=development` and `production` build, then `npm run smoke:artifact` | Both artifacts built from the clean checkout and passed the bare-bundle smoke |
| `npm run smoke:artifact` (local artifact) | Passed |

**Not run, and why.** Firefox and WebKit: the container's network policy denies `cdn.playwright.dev`, so the browsers cannot be installed, and no system build exists. The Playwright config and CI now install and run all three projects, but no Firefox or WebKit result exists yet. The CI workflow cannot be dispatched with the integration's token (403) and no pull request was opened, so remote CI has not run on this candidate. A pull request, or a maintainer dispatch, is the next step; the browser matrix required by the [Q0/Q1 plan](../qa/Q0_Q1_PLAN.md#fixtures-and-execution-environment) stays open until it passes.

## Mapping to the E1 checklist and Q1 cases

Boxes in the [E1 checklist](E1_HANDOFF.md#completion-checklist) are ticked only where Engineering evidence exists. "Independent" evidence and Design review remain open.

| Q1 case / IDs | Developer evidence | Test files |
|---|---|---|
| J01 seats, roster, sixth seat (A02/A12) | Seats 0–4 in one waiting room across five real SDK clients; sixth `joinById` refused, no seat allocated or replaced; identity and seat are server-issued even when the client supplies `seat`, `seatId`, `sessionId`, `id` | `tests/integration/admission.test.ts`, `tests/e2e/rooms.spec.ts` |
| J02 names and negotiation | Empty, whitespace-only, control-only and 17-code-point names refused before any room is created; NFC applied; markup stored and rendered as text; old protocol, wrong environment, malformed options refused with no allocation | `tests/unit/names-join.test.ts`, `admission.test.ts`, `rooms.spec.ts` |
| M01 even-tick movement (A02) | Odd ticks do not move; tick 2 moves one tile; intent persists; stop and facing follow D1; two SDK clients and two browser contexts show the same positions | `tests/unit/movement.test.ts`, `tests/integration/movement.test.ts`, `tests/e2e/movement.spec.ts` |
| M02 collisions, edge, Belt (A02) | World edge, swap, shared destination, chained follow, core/deposit/turret/wall, owned wall, and the `(22, 11)` to `(23, 11)` lethal Belt step with facing update; nothing reaches `(24, 11)` in build | same files |
| M03 seat permutation (A02/A03) | All 16 published vectors reproduced at runtime through the prototype room, against the independent Python table rather than helper output | `tests/integration/movement.test.ts` |
| K01 keys and focus (A02) | WASD and arrows; W then D then release D then release W; auto-repeat; Tab off the board; blur, hidden document, disconnect each stop the ship; each stop test also asserts the ship is short of the world edge; the blur and hidden-document tests were shown to fail when their handlers are removed (the disconnect test was not mutation-checked) | `tests/unit/client-input.test.ts`, `movement.spec.ts` |
| V01 per-seat views (A04/A12) | Build fixture, five seats: each client's decoded state and every raw received byte contain only its own sector; foreign and unowned sentinel ids are absent; own ids present as a positive control; the battle reveal adds everything; the check fails when view filtering is disabled | `tests/integration/views.test.ts` |
| A01 forged and malformed input (A12) | 16 forged payload shapes, unknown types, truncated and corrupt frames, unsupported protocol codes, text frames; state unchanged, other client unaffected, process survives | `movement.test.ts`, `limits.test.ts` |
| A02 rate and size limits (A12) | Exactly 30 accepted and the 31st dropped; reset at the window boundary on an injected clock; unknown types count; 31–60 per window never disconnects; two consecutive windows over 60 close only the offender; exactly 1 KiB accepted, 1 KiB + 1 closes only the sender with 1009 | `tests/unit/frame-limiter.test.ts`, `limits.test.ts` |
| H01 health (A11/A14) | Exact canonical fields, no-store, exact allow-origin, no host details; `rooms`/`players` move with joins; `accepting: false` at `maxRooms` while `status: ok`; capacity refusal has no side effects; recovery after rooms are freed; bare artifact agrees with its manifest | `tests/integration/health-origin.test.ts`, `scripts/smoke-artifact.mjs` |
| H02 origins and peers (A11/A12) | Wrong, missing, `null`, suffixed, prefixed, duplicated and differently cased origins refused for matchmaking, preflight and WebSocket upgrade with nothing allocated; the 21st connection from one peer refused and the slot recovers after a leave | `health-origin.test.ts` |
| L01 cleanup (A02/A12) | Last leave disposes the room; counters recover; no identity or input reaches a new room; repeated join/leave leaves nothing behind | `admission.test.ts`, `rooms.spec.ts` |
| A12 logs | Structured events carry only allowlisted fields; a scenario with a distinctive nickname, payload marker, reconnect tokens, session ids, room ids and loopback addresses leaves none of them in the log sink or process output | `tests/integration/logs.test.ts` |
| F01–F03 (E0 subset) | Artifact smoke updated for protocol 2; build regression still passes | `scripts/smoke-artifact.mjs`, `artifact-build.test.ts` |

## Engineering decisions made during implementation

These resolve points the handoff left open or that real transport forced. QA and Design should review them with this record.

| Decision | Reason and effect |
|---|---|
| **Frame-window anchor: connection accept time.** Window `k` is `[accept + k s, accept + (k+1) s)` on an injected monotonic clock. The single `JOIN_ROOM` acknowledgement the SDK sends during the handshake is not an action and is not counted; every later frame is, including `PING`, `LEAVE_ROOM` and unknown or malformed frames. | Names the anchor [Q0_REVIEW.md](../qa/Q0_REVIEW.md) asked Engineering to record for A02. The 61st frame of the second consecutive flooded window triggers the disconnect (close code 1008); it does not wait for the window to end. A client that has exhausted its window has its own leave frame dropped, so it must close the socket. |
| **Frame allowlist.** Only Colyseus `JOIN_ROOM`, `LEAVE_ROOM`, `ROOM_DATA` and `PING` frames reach the framework; request, bytes and input frames and text frames are dropped and counted. | The game has one action message. A throwing frame handler closes only its connection. |
| **Size bound by transport.** `maxPayload` is 1024; oversize frames never reach the parser. The `ws` error is counted and logged without its stack. | The offending connection receives close code 1009. |
| **Raw nickname cap of 1024 UTF-16 units**, checked before normalization. | Bounds work on hostile input. A name that is valid only after stripping more than 1000 control characters is therefore refused; this is not reachable by an honest client. |
| **Refusals use HTTP statuses** (400, 403, 409, 413, 422, 426, 503) with stable messages. | The framework's router maps only real HTTP statuses; application-specific numbers collapsed to a bare 500. `joinRejectionFromMessage` recovers the reason. Several refusals share a status, so the message carries the distinction. |
| **Extra join keys are ignored, not rejected.** | Matches "a supplied identity never replaces the admitted seat". The server never reads them. |
| **No origin bypass.** Matchmaking and WebSocket upgrades require the exact configured `Origin`. Node SDK tests send that header explicitly; there is no test-only policy. CORS allows the single configured origin with credentials for `/matchmake/*` only, because the SDK sends `credentials: include`. | A custom client can forge the header; the policy stops other websites, not custom clients, as the architecture already states. `/health` stays readable without an `Origin` and names the client origin in `Access-Control-Allow-Origin`. |
| **Peer cap counts the TCP peer address**, never forwarded headers, and applies to WebSocket connections. | Per the handoff. Localhost tests do not demonstrate production proxy correctness; that is E2. |
| **`PACKET_CLIENT_ORIGIN` and `PACKET_MAX_ROOMS`** are new settings. Local mode fixes `http://127.0.0.1:5173`; development requires `https://dev.packetscr.app`; production requires its own https origin and may not be a development, local or address origin. `PACKET_MAX_ROOMS` is 1–1000 (default 20). | Startup fails clearly on a missing or mismatched value. |
| **Seat and join order.** A seat is the lowest free index at admission. Replay order is a monotonic join sequence kept on the server; sorting by it feeds `assignSectorSlots`. | Reusing a freed seat cannot change replay order. |
| **Hidden `slot`.** A seat's sector slot and every ship and entity are `.view()` fields shared only by explicit `StateView.add`. The unowned slot is never sent as a field; in battle it is the slot with no owner. | Satisfies "unowned entities are hidden" without a new public field. |
| **Tick driver.** Real time derives ticks from the monotonic clock with an accumulator (at most four catch-up steps per poll). Tests use a manual driver. | A timer cannot fire at 66.67 ms exactly; the average rate holds at 15 Hz. A throwing tick fails closed (the room is disconnected, the process continues). |
| **`erasableSyntaxOnly`** is now on for all workspaces. | `scripts/build.mjs` loads `shared/` through Node's type-stripping; parameter properties had broken the build regression. |
| **Colyseus start-up banner disabled; plain "listening" line removed.** Stdout carries only structured events. | `server_started` marks readiness. |

## Prototype scope and visible limitations

- The `prototype` room type is registered only when `PACKET_ENV=local`. A development or production server refuses it (checked by the bare-artifact smoke). The client mounts its controls, banners and local server address only in a local build; a bundle test proves a development or production client contains none of those strings.
- The prototype shows server-owned movement on fixed test maps only. It has no scrap, combat, respawn, match start or lifecycle, and says so in its banner. A ship that steps onto the Belt during the build view is lost for that test (`alive: false`) and stays where it died; D2 and E3 own respawn and drops. A departed seat's ship stays idle in place; reconnect and removal rules belong to E5.
- The build to battle reveal is a server-side test hook (`revealBattle`). It is not a client message. Reveal evidence is therefore SDK-level; the browser journeys cover the build view and the battle view as separate fixtures.
- The ordinary waiting room is roster-only: no countdown, Quick Play, host controls or bot. Those are D3/E5.
- A non-local client build has no game server configured and says so; region selection is E6.

## Residual risks and handoffs

| Item | Owner |
|---|---|
| Firefox and WebKit execution, remote CI on the exact candidate | Maintainer opens or dispatches CI; QA records browser versions |
| Independent Q1 execution on one immutable candidate; Design control review | QA, Design; maintainer assigns reviewers on #14 |
| Matchmaking requests are not connection-counted. An unclaimed seat reservation holds a seat for the 15 s reservation window, so a flood of matchmaking POSTs can fill seats or rooms until the reservations expire. The frame, peer and `MAX_ROOMS` limits do not cover it | Engineering with E2 proxy rate limits; QA adds an abuse case at Q5 |
| Real-network, two-device and timing evidence; capacity and tick p95/p99 | Q4/Q5 |
| Reconnect identity and `sessionStorage` handling | D3/E5 |
| Draining and `accepting: false` for restarts | E7 |
