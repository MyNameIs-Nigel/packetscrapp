# E3 first harvest/build loop — 2026-10-17

Owner Codex `codex-three-steps-20261017`, Engineering, issue #55; branch `engineer/harvest-build-loop-20261017`. Current source candidate `7c206c8119c3213456a9aee3a04bf48174bd808a`, rebased onto main `dd6d78fe7a17472d2f5a5cbdb438a5d9053b21c4`. Later receipt commits change documentation/screenshots only. Claim `engineer/claim-e3` at `c24a620a687b0a5aeeeb3e07f72db07a2270e4ce`. Inputs: accepted D1 map/economy/UI revision 1, merged E1 repair #41 and generator #43, [D2/D3 Engineering acceptance](CONTRACT_ACCEPTANCE.md), independent prior-artifact/oracle review in [QA PR #54](https://github.com/MyNameIs-Nigel/packetscrapp/pull/54). A02/A03/A04/A05/A06 build subset/A12. No new dependency or tuning value.

## Observable result

Open the local build in 2–5 independent browser contexts with matching player count and uint32 seed. Choose **Start harvest/build preview**; all requested seats must join. This is separate from the unchanged E1 movement fixture and roster-only waiting room. Generated maps start with zero scrap and the accepted finite budgets; all generated entities are filtered at the serialized-state boundary.

While the board has focus, WASD/arrows move, Space fires/harvests, 1 builds Wall, 2 builds an inactive Turret, Q upgrades blaster and E upgrades hull. Purchases use start-of-tick facing/position, build before upgrade, earliest valid request per kind and exact atomic cost. Income from damage/pickups is available next tick. Owned walls are passable; turrets block movement. Empty shots consume the five-tick cooldown. Generated deposits pay their last hitter once and disappear.

DOM HUD shows own hull/core/scrap, countdown and next prices/MAX. Private rejection/success feedback persists until the next action result. The board shows the legal Manhattan-radius area, reserved/occupied exclusions and an outlined/crossed front tile. Tab, blur, hidden document and disconnect clear held input/fire; form/button keys do not send gameplay. The [built screenshot](evidence/E3_BUILD.png) uses synthetic Alpha/Bravo clients after a 10-scrap harvest and successful wall purchase; no real player data.

The Belt kills ships, drops unspent scrap once (merging any existing pickup), and a living core permits a full-hull respawn exactly 225 ticks later. Upgrades persist. Blocked spawn retries at the same reserved cell without resetting the deadline. Accidental socket loss clears control and uses one logical 300-tick expiry across respawn; authenticated recovery remains E5. Voluntary departure abandons immediately without creating scrap. Empty rooms dispose. An early build winner/result never reveals hidden sectors, freezes gameplay and disposes after 225 ticks.

Tick 1800 uses build rules through damage, then removes the Belt and reveals the complete map. **This first loop pauses for inspection there.** It is not a battle simulator. Turret/PvP combat, sudden death/full match qualification, bot/private/reconnect/spectator/region journeys and public deployment remain E4–E6/E2. Banner and HUD label these limits. No G3/complete-game/release claim.

## Transport and compatibility

Protocol is **3**, rejecting older clients at health/admission. Exact envelopes and future D3 mapping are in the acceptance receipt. Only local servers register `build_preview`; public artifacts exclude its entry controls. Per-seat queues are bounded at 30 pending validated actions; fire intent is deduplicated. All seat/position/cost/balance choices stay server-owned. Private economy fields and generated entity collections use schema views; the seed/replay artifact is never serialized. Exact Origin/frame/input limits remain in front of room processing. Rejected malformed/forged messages do not mutate balances or another seat.

The deployment pair must use the same protocol; stale clients must refresh. Restoring a prior development artifact restores both client/server/protocol. No deployment was performed.

## Actual validation

Linux managed workspace, Node 24.21.0/npm 11.19.0, current main dependency pins including Vitest 5.0.4/schema 5.0.39. Loopback without added latency; seed 42 for SDK/browser checks. All four player counts receive real generated maps.

| Check | Result |
|---|---|
| Fresh `npm ci`, format/lint/typecheck | Passed |
| `npm run test:unit` | 229 passed; 15 new build-loop cases cover cooldowns/misses, atomic spend/order, invalid/max/occupied/reserved/radius, conservation, last-hit order, Belt drop/respawn, fixed absence expiry, blocked spawn and 1800 boundary |
| `npm run test:integration` | 115 passed; six new real-SDK cases cover 2/3/4/5-player initial raw-state positive/negative controls, hidden economy, tick 1799/1800 reveal, validated harvest/forged input/private feedback and early-build result privacy |
| Built system Chromium | 12 passed; new two-context keyboard harvest/build/rejection/focus journey plus all E1 journeys; screenshot capture checked |
| Two builds/full manifest comparison; bare artifact smoke | Passed on source candidates; final documentation head built clean and independently checked before publication |
| Documentation/whitespace and diff review | Passed |
| Pinned local browsers | Installation still returns CDN HTTP 403; exact-head PR CI provides required Chromium/Firefox/WebKit evidence separately |

One local evidence-capture run failed because the new screenshot callback omitted its `testInfo` parameter. The parameter was fixed without changing product code/assertions; typecheck/lint and the focused browser case then passed. The final full browser suite is the result above. Original E1 assertions remain intact, apart from updating the forged-prototype fixture to use the current protocol constant.

Developer tests and screenshots are not independent QA or Design approval. Next handoff: QA Q2 independently verifies this candidate's economy/privacy/timers and Design reviews actual HUD/controls against D1. G1's earlier E1 evidence is preserved; this protocol/gameplay change needs the affected regression above and its own review. G3 remains open until those independent inputs pass. E4 consumes the reviewed simulation/action/view foundations for battle and match endings.
