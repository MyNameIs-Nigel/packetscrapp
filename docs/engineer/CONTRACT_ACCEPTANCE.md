# Engineering contract acceptance — 2026-10-17

Owner Codex `codex-three-steps-20261017`, Engineering, under maintainer-requested #55. Reviewed main `94d6c9fed5f6959dff693302e45459ffd48f4802`, including Design #44 and map #43. QA's separate review of these pre-existing authors' artifacts is [PR #54](https://github.com/MyNameIs-Nigel/packetscrapp/pull/54), `docs/qa/Q1_REPAIR_RETEST.md`. The maintainer explicitly requested acceptance of the remaining contracts and implementation of the first build loop. No new rule values are proposed here.

## Accepted implementation inputs

| Artifact | Engineering disposition and reason |
|---|---|
| D1 map/economy/UI revision 1; map generator `d1-deposits-mulberry32-r1` | Accepted. Generator mirrors the approved Design template exactly; pinned streams, bounded retries and verified fallback are finite/replayable. QA independently checks actual output; no new fairness/balance claim. |
| D2 combat/lifecycle revision 2 | Accepted as feasible deterministic tick rules. Snapshot fire, stable ordered damage, wall priority, integer supercover LOS, cooldown-consuming misses, max-hull-bonus healing, core-final-state eligibility, blocked respawn and absolute disconnect expiry have finite algorithms and explicit boundary tests. |
| D2 duration/UI revision 1 | Accepted. Ring 0 at tick 4500, 30-tick subsequent cadence and 225-tick results window are the maintainer-requested implementation baseline. Arithmetic reproduces 4830/5190 ending ticks. Human pacing and real-time Q3 evidence remain later acceptance. |
| D3 revision 1, J01–J21 | Accepted player/role/identity outcomes. One serialized room event order handles lobby/start races. 10 external watchers plus 5 retained former players is a bounded admission budget, not measured server capacity. Build and early-result filtering must remove eliminated-sector membership. The supported transport mapping below is the E5/E6 baseline, not an implemented feature. |

Accepted inputs permit their dependent slices; they do not award G3–G6 or approve new code authored by this run. Independent Q2/Q3/Q4 and Design runtime reviews remain required. Original Design proposal receipts are historical and retained.

## E3 transport mapping

Protocol 3 bumps E1 protocol 2 because schema and action capabilities change. `build_preview` is a **local-only**, labelled first-loop room, separate from unchanged E1 `prototype` and roster-only `match`. Local room options use the existing strict seats/uint32 seed/view parser, with view fixed to build; matching includes all three options and the room locks when full. User-chosen local seeds are fixtures, not public gameplay policy.

- `move` retains exact `{direction}` and latest valid intent.
- `fire` has no payload; one fire intent per tick, five-tick cooldown, including misses.
- `build` is exactly `{kind:"wall"|"turret"}`; `upgrade` is exactly `{kind:"blaster"|"hull"}`. Extra fields and client-supplied seat/position/balance are rejected. Per-seat pending work is bounded to 30; stage processing selects the earliest valid build, then earliest valid upgrade. Fire income is spendable next tick.
- Private `feedback` is exactly `{text:string}` from a fixed server vocabulary; no hidden enemy data or echoed input. The HUD keeps it until the next action result.
- Per-player private fields are view-tagged; all generated entities live behind existing per-sector schema views. Only public participant markers are global. No seed or replay state enters a public schema.

The preview performs the 120-second build loop, Belt deaths/drops, core-backed 225-tick respawns, voluntary abandonment and logical 300-tick absence expiry, then pauses for inspection at the tick-1800 authoritative reveal. It deliberately does not simulate battle, turret firing, sudden death or full-match win/draw qualification. An early build ending retains privacy and its 225-tick disposal timer. E5 recovery is not registered: accidental socket loss stops control, and the logical contender follows its fixed expiry while any other clients remain. Empty rooms dispose immediately. These are labelled intermediate-slice limits, not revisions to the accepted full-game contract.

## E5/E6 transport and identity baseline

Pinned Colyseus core 0.18.18 supports `onDrop`, `onReconnect`, `allowReconnection(client,"manual")` and `Deferred<Client>`; SDK 0.18.5 supports `Client.reconnect` and `Room.reconnectionToken`. Framework wall-clock reservation duration is not the gameplay deadline. The future E5 room must check its own server tick/role on admission and reject at `d+300` before timer-stage processing, cancel its manual reservation at expiry and enforce one authoritative connection epoch per seat.

Wire baseline: `start` and authenticated `leave` have no payload; `bot` is exactly `{action:"add"|"remove"}`. Gameplay envelopes are those above. Waiting operations require the current private host; no host privilege survives start. Admission uses strict public/private/watch options, never a claimed role or seat. Refusals use stable 400 malformed, 403 permission, 409 phase/session conflict, 410 expired/disposed, 426 protocol and 503 capacity categories with fixed readable messages. Existing HTTP/upgrade Origin, size and frame policies extend to every new route.

Use a private application recovery credential in addition to the framework's replaceable socket token. Generate 256 bits of cryptographic randomness, retain only a hash bound to environment/region/room/seat, and store the raw credential only in tab sessionStorage. A narrowly scoped exact-Origin recovery POST can exchange it for the current SDK reconnect reservation; the room still performs the authoritative tick/role/connection-epoch checks. Rate/body limits and no-store apply; neither credential nor responses may enter logs, URLs, public schemas or analytics.

Rotation is an offer/persist/ack protocol: send one pending replacement privately; client atomically persists it before acknowledgement; server commits replacement only after matching acknowledgement. Before acknowledgement, current and pending credentials may recover the same seat only within the **original** absolute eligibility window; at most one pending credential exists. Pending recovery never extends the deadline and every successful attach supersedes the previous socket epoch. Delivery lost before persistence leaves the old credential valid; acknowledgement lost after persistence leaves the pending credential recoverable; acknowledgement received means the client already persisted the new credential. Clear both on expiry, authenticated leave or disposal. Recovery never upgrades an eliminated seat back to player or reveals its former build sector. Storage unavailable preserves current play and advertises unavailable automatic recovery.

This pins a feasible design rather than claiming untested SDK tokens rotate safely by themselves. E5 must demonstrate both interrupted-ack schedules, replay/second-owner refusal, exact tick expiry and former-player filtering through real SDK transport before its identity slice is accepted. A bearer credential authenticates its holder until rotation/expiry; do not claim protection after deliberate credential disclosure. E6 must test watcher budgeting and actual regional services. Those implementation and runtime reviews are required next checkpoints, not missing product decisions blocking D1 harvesting.
