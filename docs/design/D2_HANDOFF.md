# Full D2 phase handoff

Status: **In review — proposed contracts, no independent acceptance or runtime verification.** Tracking [#29](https://github.com/MyNameIs-Nigel/packetscrapp/issues/29). Owner: Codex run `codex-d2-full-20261004`, Design. Engineering and QA review; maintainer @MyNameIs-Nigel coordinates named acceptance. This package supplies every D2 documentation deliverable in one reviewable phase, alongside the separately owned E1 implementation.

## Prerequisites and revision receipt

| Input | Evidence and use |
|---|---|
| Accepted D0 revision 1 | #3, `807e43f15ac64109fc293943117e074867c2ebb3`: keyboard scope, entry boundaries and match pacing intent. |
| Accepted D1 map revision 1 | #4, `6221df4354e04ebfde3e903d33480765994f8aa7`: 24-square sectors, all dimensions, facing/movement/Belt and reserved spawn. |
| Accepted D1 economy revision 1 | #7, `0f1aad18a43ee6272faf507e2a10d80248011c90`: deposits, costs, atomic purchases, build radius and scrap conservation. |
| D1 UI revision 1 | #6, `53c2357e39f57303df2c3095df2eafa0fb7fa26a`: HUD, readable feedback and focus baseline. |
| Earlier D2 proposals | #26 / `fa28aac662a28785e974b6c51bcd9e50ef647735`; #28 / `14bbc4fcbaa02fb07c8452b0e521e5a647d93152`: merged proposals, no recorded Engineering/QA acceptance. Superseded where explicitly stated below. |
| Isolated delivery base | `14bbc4fcbaa02fb07c8452b0e521e5a647d93152`; branch `design/d2-full-phase-20261004`; original claim `refs/heads/design/claim-d2` at `1be13dec30589ef18b995f899550776abd6a905e`. |

## Entire phase coverage

| D2 package | Full deliverable | Readiness / reviewing owner |
|---|---|---|
| 1 Combat | [Combat revision 2](../GAME_DESIGN.md#d2-combat-collision-and-targeting-contract--revision-2): beams, owner-wall overlap, exact LOS, ties, simultaneous hits, deposits/drops, hull healing and cooldown edges. | Engineering/QA review exact geometry and simultaneous resolution before E4/Q3. |
| 2 Contenders | [Lifecycle revision 2](../GAME_DESIGN.md#d2-contender-and-win-draw-contract--revision-2): every role transition, occupied spawn, core loss, fixed disconnect expiry, departure and win/draw. | Engineering/QA accept before E3 death slice and E4; D3 consumes the expiry/role contract. |
| 3 Finite duration | [Boundary/duration revision 1](../GAME_DESIGN.md#d2-phase-boundaries-and-finite-duration--revision-1): phase/timer order, all four layout calculations and exact before/at/after examples. | Engineering/QA review tick convention and cadence; maintainer coordinates pacing approval. |
| 4 UI and balance | [D2 UI revision 1](D2_UI.md): annotated HUD/results, core loss/death/respawn/elimination, keyboard/copy paths and five balance experiments with allowed levers. | Engineering/QA review testability; D4 later runs experiments and Design reviews actual UI. |

Primary acceptance IDs: **A06/A07**. Boundary implications: A02 focus/movement, A04 death/reveal privacy, A05 conservation and purchases, A09 disconnect role expiry. Q2/Q3 own independent execution; Q4 consumes D3 journeys. E3/E4 provide runtime candidates. No implementation, QA approval, G0/G1/G4 closure, deployment, playtest or release is supplied by this Design package.

## Changes requiring explicit acceptance

1. Revision 1 falsely drew simultaneous ship deaths even with living cores. Revision 2 follows its contender definition: two live cores mean two respawn waits; two destroyed cores mean a draw; one living core means that remaining contender wins. Summary wording and examples agree.
2. Empty accepted blaster shots now consume cooldown, so advertised fire rate applies to misses as well as hits. Turret corner geometry uses an exact supercover and blocks active Belt; owned-wall overlap has explicit collision priority.
3. All recorded same-tick shots survive attacker destruction; last-hit credit stays seat-ordered. Ship death eligibility uses the core's final state after damage, removing attacker-order-dependent respawns. Drops zero the seat balance once.
4. A blocked reserved spawn waits without relocating or stacking. Disconnect uses one 300-tick deadline across death/respawn rather than granting a fresh window on every respawn. Voluntary departure eliminates immediately. D3/E5 must review reconnect timing and user notices against this contract; the transport identity design remains theirs.
5. Sudden death shatters cores before due respawns, starts ring 0 at tick 4500, and advances every 30 ticks. The original 45-tick cadence allowed 6:09; the proposal yields a 5:46 maximum. Results last 225 ticks, explicitly outside the match duration.

A merge alone does not accept these decisions. Reviewers should record accepted/rejected revisions and exact examples on #29/its PR; any change to geometry, timers, values or roles triggers affected contract and case updates. Source rules stay in GAME_DESIGN/ARCHITECTURE; this file is a delivery/evidence receipt.

## Paper walkthrough and verification

The documentation author checked the following expected transitions; these are contract reasoning, not independent QA or executed gameplay:

| Scenario | Expected final state |
|---|---|
| Two ships die, both cores living | Two `awaiting_respawn` contenders; no result. |
| Two ships die, both cores destroyed | Both permanently eliminated; draw set contains those two only. |
| Two ships die, only one core living | Core-backed seat wins while awaiting respawn. |
| Ship and core die from differently ordered hits | Permanently eliminated in either order; one scrap drop. |
| Respawn is due exactly on tick 4500 | Core shatter cancels it before spawn; no resurrection. |
| Respawn tile remains occupied until sudden death | Seat remains contender while core lives; shatter cancels wait; termination bound holds. |
| Absent ship dies and respawns before grace expiry | Same disconnect expiry persists; expiry eliminates even with a core. |
| Final two living ships occupy last safe ring | Both die on final expansion; no cores or pending respawns remain; draw. |
| Earlier eliminated seat and later final mutual kills | Earlier seat excluded from final draw set. |

For the mathematical check, independently enumerate every coordinate's distance to the outer edge for `(48,24)`, `(48,48)`, `(48,48)`, `(72,48)`. Verify each cumulative ring is a subset of the next, the penultimate step leaves safe cells, the final step covers every cell, and computed ending/disposal ticks match the source table. Record the exact procedure/results in the PR evidence. This validates arithmetic and coverage only; it cannot validate simulation code, real-time load, browser rendering or server disposal.

Required local documentation commands: `python3 scripts/check_docs.py` and `git diff --check`. Validate new/changed Markdown anchor targets too, because the repository checker only checks target files. PR CI runs the required repository and existing application suites; passing E0 harness checks still cannot establish D2 gameplay.

Local receipt, 2026-10-04: macOS 26.6.2 (25G83), Python 3.9.6, Node 24.21.0/npm 11.19.0. Documentation and whitespace checks passed. The enumeration covered 1,152 / 2,304 / 2,304 / 3,456 cells and reproduced ending ticks 4830 / 5190 / 5190 / 5190 and disposal ticks 5055 / 5415 / 5415 / 5415. Local Markdown anchor links in affected documents passed a heading/explicit-anchor check. No seed is needed for the all-cells calculation. Exact full candidate SHA and CI run receipt are recorded on the PR and #29, because this file is part of that candidate.

Reproduce the independent arithmetic from this worktree:

```sh
python3 - <<'PY'
from collections import Counter
for players, width, height, expected_tick in (
    (2, 48, 24, 4830), (3, 48, 48, 5190),
    (4, 48, 48, 5190), (5, 72, 48, 5190),
):
    rings = Counter(min(x, y, width-1-x, height-1-y)
                    for x in range(width) for y in range(height))
    assert sorted(rings) == list(range((min(width, height)+1)//2))
    covered = 0
    for ring in sorted(rings):
        assert covered < width*height
        covered += rings[ring]
    assert covered == width*height
    ending_tick = 4500 + 30*max(rings)
    assert ending_tick == expected_tick and ending_tick <= 5400
    print(players, covered, ending_tick, ending_tick/15, ending_tick+225)
PY
```

## Phase exit and next handoff

- [x] All four D2 packages have complete proposed rule/UI deliverables and observable examples.
- [x] All four layouts have a paper termination calculation with the six-minute pacing implication stated.
- [x] Live-core simultaneous deaths, pending respawns, core-loss and disconnect expiry have consistent expected outcomes.
- [x] Combat feedback and keyboard paths are specified; balance experiments and levers are identified.
- [ ] Engineering accepts the exact combat/timer/role revisions and confirms implementation feasibility.
- [ ] QA accepts every boundary oracle and translates them to independent Q2/Q3 cases.
- [ ] Maintainer records disposition of cadence/pacing and coordinates reviewers.

After acceptance, E3 can implement core-backed build deaths; E4 can implement the complete combat lifecycle; Q3 can prepare oracles before executing those candidates; D3 can specify reconnect/watcher/replay journeys using these roles and deadlines. G4 still needs actual deterministic and real-client full-match evidence plus Design UI review. D4 needs a qualified playable candidate for balance observations.
