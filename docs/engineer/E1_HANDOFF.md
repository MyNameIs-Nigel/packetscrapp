# E1 implementation handoff

Status: QA reviewed this supplement in [Q0_REVIEW.md](../qa/Q0_REVIEW.md) under [#19](https://github.com/MyNameIs-Nigel/packetscrapp/issues/19). That review is not implementation and does not verify G0 or G1. [#21](https://github.com/MyNameIs-Nigel/packetscrapp/issues/21) pins slot-index origin and the Fisher–Yates variant below so M03 can name expected seats; it does not implement rooms or movement. The other decision rows have QA test oracles; the maintainer records whether E1.1 may start. [#14](https://github.com/MyNameIs-Nigel/packetscrapp/issues/14) tracks broader E1 and G1. No E1 runtime criterion has passed. The [gate audit](../PROGRESS.md), [Q0/Q1 plan](../qa/Q0_Q1_PLAN.md), and source specifications control acceptance.

## Accepted inputs

| Input | Accepted artifact | Use |
|---|---|---|
| E0 workspace | [#9](https://github.com/MyNameIs-Nigel/packetscrapp/pull/9), merge `3e416d387e86b98736f995d1b9d2422adba083fd`; original candidate `34c61a07eea3529db66935dfb2039487126cf178` | Pinned commands, real transport, manifest and standalone bundle. Independent evidence is in the audit; #13 fixes stale build output. |
| D0 scope/entry revision 1 | [#3](https://github.com/MyNameIs-Nigel/packetscrapp/pull/3), merge `807e43f15ac64109fc293943117e074867c2ebb3` | Scope, terminology, ten-second lobby and separate 20-second solo measures. PR #3 records Engineering/QA acceptance. |
| D1 movement/map revision 1 | [#4](https://github.com/MyNameIs-Nigel/packetscrapp/pull/4), merge `6221df4354e04ebfde3e903d33480765994f8aa7` | All layouts, core/spawn coordinates, Belt cells, movement/facing/collision and visibility. PR #4 records Engineering/QA contract acceptance. |
| D1 UI revision 1 | [#6](https://github.com/MyNameIs-Nigel/packetscrapp/pull/6), merge `53c2357e39f57303df2c3095df2eafa0fb7fa26a` | Keyboard focus, text status, objective/control hints; later shop/journey sections stay with E3/E5/E6. |

The [movement rules](../GAME_DESIGN.md#d1-movement-and-map-contract--revision-1) remain authoritative. E2 infrastructure, D2 combat/respawn resolution, full D3 journeys, and Q5 load measurements are not prerequisites to E1. They have their own entry criteria in the [delivery plan](../DELIVERY_PLAN.md).

## Technical decisions for review

These supply previously unspecified Engineering choices. Accept this supplement through the prerequisite PR; do not infer that a written choice has been implemented unless a later package records runtime evidence.

| Interface | Decision and reason | Expected example |
|---|---|---|
| Replay | Use `createSeededRandom` (Mulberry32 revision 1), an unsigned 32-bit map seed, and an ordered server-issued seat list. Record algorithm/config revision and join order. Never use this generator for identities or tokens. | Seeds `0`, `1`, `42`, `4294967295` reproduce the pinned reference stream. Invalid/fractional seeds fail. |
| Sector assignment | Slot indexes are **zero-based**, row-major left-to-right then top-to-bottom. Layouts: 2→`[0,1]`; 3/4→`[0,1,2,3]`; 5→`[0,1,2,3,4,5]`. Permitted unowned candidates in ascending order: none for 2/4; all four for 3; center-column `[1,4]` for 5. When candidates exist, draw `unowned = candidates[floor(next() * candidates.length)]` first. Build the owned list as every remaining slot in ascending index order. Shuffle that owned list with Durstenfeld Fisher–Yates revision 1: for `i = n-1 … 1`, set `j = floor(next() * (i + 1))` and swap `owned[i]` with `owned[j]`. Map admitted seats in join order onto the shuffled owned list with no second draw. Two- and four-player layouts skip the unowned draw and shuffle every slot. Shared helper: `assignSectorSlots` in `@packetscrapp/shared`. | Five players, seed `42`: unowned slot `4`; owned slots in seat order `[1, 0, 5, 3, 2]`. Three players, seed `42`: unowned `2`; owned `[0, 3, 1]`. Unit vectors cover seeds `0`, `1`, `42`, and `4294967295` for every player count. |
| Identity/name | The server creates identity. Strip U+0000–001F and U+007F–009F, normalize NFC, trim, then require 1–16 Unicode code points; reject overlength rather than truncate. Render names as text. | A supplied identity never replaces the admitted seat; whitespace-only name is rejected; markup appears literally. |
| Movement payload | `{ direction: "up" | "down" | "left" | "right" | "none" }`, exact keys. Server receipt order chooses the latest validated intent. Store one intent per seat, consume under D1's even-tick rule; never queue unbounded actions. | Extra `x`, `health`, `scrap`, `seatId` or non-enum values fail without changing the previous intent. |
| Key focus | Map WASD/arrows identically; latest held direction wins. Release sends the next held direction or `none`; blur, hidden document, and disconnect clear held input. Restrict gameplay handlers to the focused game surface. | Holding W then D moves right; release D resumes up; release W stops. Typing in a field and scrolling outside the surface do not send movement. |
| Tick time | Simulation advances integer ticks at 15 Hz, using injected clock/seed interfaces. Positions derive from simulation ticks, never client timestamps. Interpolation only draws received tiles. | Odd ticks do not move; tick 2 moves one tile. A client-supplied future timestamp cannot accelerate movement. |
| Health/protocol | Implement the canonical `version` and `protocol` fields in [REGIONS_AND_HEALTH.md](../REGIONS_AND_HEALTH.md), plus its readiness/counters. E0 currently exposes `sha` and `protocolVersion`; changing the harness/state contract requires a protocol bump to 2 and simultaneous client/SDK fixture updates. | Old protocol or wrong environment is rejected before seat allocation; a built health probe agrees with the manifest. |
| Capacity/origins | Validate a positive `MAX_ROOMS` (provisional 20), max five seats, and max 20 concurrent connections per peer IP. Use exact configured environment origins for HTTP and WebSocket admission; local browser origin is `http://127.0.0.1:5173`. SDK tests use explicit test-only admission policy, never a public origin bypass. | Sixth seat fails; capacity sets `accepting: false`; wrong/missing browser Origin fails; health `status: ok` can coexist with `accepting: false`. |
| Message limits | Bound application WebSocket frames to 1 KiB and JSON depth/shape through exact validation. Count all frames, including unknown/malformed actions, in one per-connection fixed monotonic one-second window. Accept at most 30 actions/window; drop excess; disconnect after two consecutive windows each exceeding 60 frames. Test boundaries and reset. | A 31st action is dropped; over-limit frame is rejected before parsing; sustained flooding closes only the offender. Waiting queues remain one movement intent/seat. |
| Logs | Structured event type, environment, region and SHA; redact names, full payloads, addresses and reconnect/authorization tokens. | Input rejection records reason/counter; logs do not repeat attacker payloads or credentials. |

### Worked sector-assignment example (seed 42, five players)

1. Slots in row-major order: `0 1 2 / 3 4 5`. Center-column unowned candidates: `[1, 4]`.
2. First Mulberry32 draw under seed `42` yields `floor(next() * 2) = 1`, so unowned = `4` (bottom-center).
3. Owned list before shuffle, ascending: `[0, 1, 2, 3, 5]`.
4. Durstenfeld passes consume the same stream and produce owned seat order `[1, 0, 5, 3, 2]`.
5. Admitted seat 0 therefore receives slot `1`, seat 1 receives `0`, seat 2 receives `5`, seat 3 receives `3`, seat 4 receives `2`.

Peer-IP limits count the actual transport peer; forwarded headers become trustworthy only through E2's reviewed proxy setup. Test isolation must avoid turning localhost's shared address into evidence of production proxy correctness.

## E1 boundaries and PR slices

0. **E1.0 sector-assignment pin:** document zero-based indexes, Durstenfeld formula, and worked examples; ship `assignSectorSlots` with unit oracles. Does not admit players or move ships. Tracked by [#21](https://github.com/MyNameIs-Nigel/packetscrapp/issues/21).
1. **E1.1 admission:** implement room creation/join, sanitized names, server identities, environment/protocol negotiation, five seats, waiting roster and empty-room disposal. Deliver SDK tests for 2–5 clients and sixth-seat rejection.
2. **E1.2 movement:** implement pure seeded layouts and D1 cardinal movement/collision, the tick loop, Canvas interpolation and keyboard focus. Consume the pinned assignment helper for seat replay. For shared movement evidence use a clearly labelled local movement prototype with a battle-view test fixture. Its fixture bypasses lifecycle only in local tests; ordinary waiting state remains roster-only. This avoids exposing enemy positions during build and does not claim combat, match starts, or respawn behavior. Test lethal Belt classification under D1; integrated Belt damage/respawn remains E3/D2 work.
3. **E1.3 authority/views/health:** wire bounded validation/rate/frame/connection limits, readiness and origin policies, private structured events, and per-seat serialized-view fixtures. Demonstrate own-sector-only build data and a battle reveal in local fixtures; actual build timer and full gameplay reveal belong to E3. QA verifies both real received messages and two independent browser contexts; Design reviews the controls.

Do not add debug fixture controls to public builds, expose private entities to satisfy a movement demo, or start implementing unresolved combat/respawn rules. Every prototype limitation must be visible in the demo and evidence record.

## Completion checklist

- [ ] #13 changes integrated; Q0 baseline reviewed; E0 independently repeated on the resulting candidate.
- [x] Sector-assignment index origin and Fisher–Yates formula pinned with recomputable examples (#21). Runtime map wiring still open under E1.2.
- [ ] Two real SDK clients and two independent built-browser contexts agree on movement and identity.
- [ ] All four seeded layouts and D1 boundary/collision/facing cases pass; forged state cannot change authority.
- [ ] Five seats work; sixth rejected; final disconnect disposes rooms and counters recover.
- [ ] Malformed/unknown/oversized/flooded input, Origin/environment/protocol mismatch, and capacity boundaries pass.
- [ ] Per-seat view tests inspect received state; no enemy/unowned entities leak in build fixtures.
- [ ] Canonical no-store health metadata and exact Origin policy agree with the built candidate.
- [ ] Required root commands and CI pass; Design control review and independent Q1 evidence name the same full SHA, config/seed and contract revision.

Only the completed checklist closes G1. The maintainer (@MyNameIs-Nigel) owns assignment and checkpoint review under #14 until named team reviewers replace that fallback owner.
