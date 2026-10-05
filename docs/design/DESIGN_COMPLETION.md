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

## E1 controls — Design review (#38)

Engineering repair #41 is merged at `3357587e7bdb5203b3ead110965fe84f5bf67834`. The [current control receipt](E1_CONTROL_REVIEW.md#retest-after-merged-engineering-repair) records a clean build at `cf40abb7904fb4ac37fbd763df8814d46935e55e` with identical application/test/configuration content to that merged repair. All 11 existing built system-Chromium journeys pass. Separate Design observation confirms board/Leave focus, off-board input rejection, held-key blur stopping, before-edge two-client convergence, reduced-motion setting and readable light/dark 1280/640-pixel layouts. Screenshots and JSON accompany that receipt.

Design accepts the observed E1 prototype movement/focus intent within this coverage. Original trace access is unavailable, and pinned local browser downloads still fail HTTP 403; neither is described as tested. Independent QA #32 owns origin/raw-frame/browser acceptance and defect disposition. G1 stays open pending that evidence; D4/D5 still require their playable/release inputs.

## Validation and remaining review

Linux, Python 3.12.14, pinned Node 24.21.0/npm 11.19.0. Documentation/whitespace, phase-claim helper (3 tests), formatting, lint, types and 190 unit checks pass. The 11 built browser checks use system Chromium 151.0.7922.173, protocol 2, seed 42, loopback. Head-specific CI is recorded on the PR after publication; another SHA's CI cannot substitute.

Design deliverables for #29/#33 and the scoped #38 observation are complete in this branch. Engineering/QA acceptance of D2/D3, real later-phase implementation, independent QA retest and shared gates retain their existing owners. This is one Design PR with no product/dependency/protocol/deployment/release change.

## Main synchronization

Initial fetched main was `c057b55d444b81db1cf48988325351acfccca3f4`. Engineering repair #41 merged during discovery; main `3357587e7bdb5203b3ead110965fe84f5bf67834` was incorporated before Design edits. Each issue completion is committed before fetching/rebasing onto main. The final PR records the last synchronized base and validation candidate.

After #29 and after #33, fetch/rebase both confirmed main at `3357587e7bdb5203b3ead110965fe84f5bf67834`; the built #38 observation uses that repaired application. The final issue/final-publication fetches are recorded in the PR handoff.

For the maintainer-authorized merge, main was refreshed to `595edd76caeab7705b34538a205598d9165d0371` (Engineering #43, standalone E3 deposit preparation). The only merge conflict was adjacent additions in PROGRESS; both Engineering and Design checkpoint receipts were retained. Original browser observations remain tied to their recorded E1 candidate. The updated merge candidate requires fresh repository/application CI before merging PR #44.
