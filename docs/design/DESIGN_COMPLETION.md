# Combined Design completion receipt

Owner: `codex-design-all-20261005`, Design. The maintainer requested every open Design issue in one PR: [D2 #29](https://github.com/MyNameIs-Nigel/packetscrapp/issues/29), [D3 #33](https://github.com/MyNameIs-Nigel/packetscrapp/issues/33), and [E1 controls #38](https://github.com/MyNameIs-Nigel/packetscrapp/issues/38). Work is isolated on `design/complete-design-issues-20261005`. D4/D5 have no open Design issue and require qualified gameplay/playtest/release inputs; their existing preparation remains applicable.

Accepted source inputs remain D0 revision 1 (#3), D1 movement/map revision 1 (#4), economy revision 1 (#7) and UI revision 1 (#6). D2/D3 are proposed specifications; Design completion does not confer Engineering feasibility acceptance, independent QA approval, gameplay implementation or shared-gate closure.

## D2 — combat and lifecycle (#29)

Reviewed all four packages against GAME_DESIGN, ARCHITECTURE, D2_UI and D2_HANDOFF. Corrected the early build-ending lifecycle table, abandonment scrap cleanup, and eliminated-player watching copy. No combat values, tick cadence, duration bound or accepted D1 economy rule changed. Proposed D3 supplies the retained former-player connection policy.

Repeated the handoff's Python all-cell enumeration on Linux, 2026-10-05 UTC. Each successive ring adds cells, the penultimate expansion leaves safe cells, and the final expansion covers the board:

| Players | Cells checked | Rings | Latest ending tick / duration | Latest disposal tick |
|---|---:|---:|---|---:|
| 2 | 1152 | 12 | 4830 / 322 seconds | 5055 |
| 3 | 2304 | 24 | 5190 / 346 seconds | 5415 |
| 4 | 2304 | 24 | 5190 / 346 seconds | 5415 |
| 5 | 3456 | 24 | 5190 / 346 seconds | 5415 |

Paper transitions reviewed: two simultaneous deaths with 0/1/2 living cores; ship/core hit ordering; blocked spawn; respawn due at 4499/4500/4501; fixed disconnect expiry across a respawn; immediate departure and scrap cleanup; early build result/privacy; final mutual elimination excluding earlier eliminated seats. These are Design reasoning and arithmetic, not executed simulation or independently approved QA oracles.

Engineering/QA still review combat/lifecycle revision 2 and duration/UI revision 1 under #29. Cadence/pacing disposition remains with the maintainer. Runtime Q2/Q3 and G3/G4 wait for their actual candidates.

## D3 — player journeys (#33)

Reviewed all four packages and J01–J20 against accepted D1 and proposed D2. Added legal firing/build poses for the bot: facing requires a successful step, and neither a blocked move nor a client-only rotation can aim. Added J21 for an early-build result and recovery without an unauthorized reveal. Reconciled the D2 eliminated-role recovery row with D3's watcher-only restoration and made Architecture's protocol-versus-SHA compatibility rule explicit.

Paper walkthroughs cover both bot/start/admission race orders, host transfer, all seven role permission rows, recovery at `d+299`/`d+300`/`d+301`, ten external watchers plus five former players, early-build result filtering, perpendicular bot arrival and blocked facing, fresh replay identity, and region A→fallback B→restored A with stale responses. J01–J21 remain proposed oracles for Engineering/QA acceptance and independent Q4 execution. D3 introduces no runtime protocol change in this PR.

## Main synchronization

Initial fetched main was `c057b55d444b81db1cf48988325351acfccca3f4`. Engineering repair #41 merged during discovery; main `3357587e7bdb5203b3ead110965fe84f5bf67834` was incorporated before Design edits. Each issue completion is committed before fetching/rebasing onto main. The final PR records the last synchronized base and validation candidate.
