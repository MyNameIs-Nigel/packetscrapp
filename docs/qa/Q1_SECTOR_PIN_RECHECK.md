# Q1 independent recheck of the E1 sector-assignment pin

Status: independent QA oracle recheck recorded for [#23](https://github.com/MyNameIs-Nigel/packetscrapp/issues/23). This confirms the published #21 pin against the handoff formula. It is not a runtime Pass for M03, not Design acceptance, and not **Verified** for G0 or G1. The reviewer did not author [#21](https://github.com/MyNameIs-Nigel/packetscrapp/issues/21) or [#22](https://github.com/MyNameIs-Nigel/packetscrapp/pull/22).

## What was compared

Review date: 2026-10-04 UTC. Pin candidate / base: `f93684523cf4562155f477d1caebf96fac6bae20` (merged #22 on `main`). Environment: Linux cloud runtime, Python 3.9+ uint32 arithmetic only for the independent recomputation. Sources:

- [E1 handoff](../engineer/E1_HANDOFF.md) sector-assignment decision row and worked example (seed `42`, five players)
- Merged Mulberry32 revision 1 formula in `shared/src/random.ts`, with integer stream vectors in `tests/unit/determinism.test.ts`
- Published unit oracle table in `tests/unit/sector-assignment.test.ts`
- Prior Q0 follow-up note in [Q0_REVIEW.md](Q0_REVIEW.md) that deferred this reading

Authority for expected seats is the handoff formula recomputed here. The TypeScript helper and its unit file were compared afterward; their outputs were not copied into the oracle.

## Independent recomputation method

1. Reimplemented Mulberry32 revision 1 with unsigned 32-bit state and `Math.imul`-compatible multiplies in Python.
2. Confirmed the first three integer draws (`floor(next() * 2^32)`) match the pinned vectors for seeds `0`, `1`, `42`, and `4294967295`.
3. Applied the handoff layouts: slots and unowned-candidate sets for player counts 2–5; unowned draw `floor(next() * candidates.length)` when candidates exist; Durstenfeld descending `i` with `j = floor(next() * (i + 1))` on the owned list.
4. Walked the five-player seed-`42` worked example draw-by-draw before comparing the full 16-vector table.

### Worked example walk (five players, seed 42)

| Step | Draw `next()` | Use | Result |
|---|---|---|---|
| Unowned | `0.6011037519201636` | `floor(next() * 2)` over candidates `[1, 4]` | unowned = `4` |
| `i = 4` | `0.44829055899754167` | `j = floor(next() * 5) = 2`; swap on `[0, 1, 2, 3, 5]` | `[0, 1, 5, 3, 2]` |
| `i = 3` | `0.8524657934904099` | `j = 3`; swap with self | `[0, 1, 5, 3, 2]` |
| `i = 2` | `0.6697340414393693` | `j = 2`; swap with self | `[0, 1, 5, 3, 2]` |
| `i = 1` | `0.17481389874592423` | `j = 0`; swap | owned = `[1, 0, 5, 3, 2]` |

Matches the handoff worked example and the three-player seed-`42` example (`unowned = 2`, owned `[0, 3, 1]`).

## Oracle table result

All sixteen published `(playerCount, seed)` vectors match the independent recomputation:

| Players | Seed | Unowned | Owned seats |
|---|---|---|---|
| 2 | 0 | none | `[1, 0]` |
| 2 | 1 | none | `[0, 1]` |
| 2 | 42 | none | `[0, 1]` |
| 2 | 4294967295 | none | `[0, 1]` |
| 3 | 0 | 1 | `[2, 3, 0]` |
| 3 | 1 | 2 | `[3, 1, 0]` |
| 3 | 42 | 2 | `[0, 3, 1]` |
| 3 | 4294967295 | 3 | `[2, 1, 0]` |
| 4 | 0 | none | `[3, 2, 0, 1]` |
| 4 | 1 | none | `[3, 1, 0, 2]` |
| 4 | 42 | none | `[0, 3, 1, 2]` |
| 4 | 4294967295 | none | `[2, 1, 0, 3]` |
| 5 | 0 | 1 | `[2, 3, 4, 5, 0]` |
| 5 | 1 | 4 | `[5, 1, 3, 2, 0]` |
| 5 | 42 | 4 | `[1, 0, 5, 3, 2]` |
| 5 | 4294967295 | 4 | `[5, 1, 3, 2, 0]` |

Five-player unowned picks for those seeds stay in the center column `{1, 4}`. No defect was filed against #21/#22.

## Gate effect

- M03's exact seat-permutation **oracle** remains Ready and is now independently rechecked. Runtime execution stays Blocked on E1.2 map wiring.
- G0 stays open: the maintainer still records whether accepted oracles clear E1.1 under [#14](https://github.com/MyNameIs-Nigel/packetscrapp/issues/14).
- G1 stays blocked on E1.1–E1.3 implementation plus independent Q1 execution and Design control review.

## Next owners

| Need | Owner | Unblocks |
|---|---|---|
| Record whether accepted oracles authorize E1.1 admission | Maintainer, on #14 | E1.1 start |
| Implement E1.1–E1.3 | Engineering | Runnable Q1 candidate |
| Execute M03 (and remaining Q1 cases) on one immutable candidate | QA | G1 evidence with Design control review |

No product rule was changed in this recheck.
