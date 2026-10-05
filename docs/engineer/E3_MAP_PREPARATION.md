# E3 deterministic deposit map preparation

Status: **In review**, Engineering preparation under [#42](https://github.com/MyNameIs-Nigel/packetscrapp/issues/42); QA/Design review output before integrated gameplay. This completes the pure generation subset of E3 package 1. G3 remains open: no running build clock, harvest/shop/death/respawn or client HUD is delivered. Sources: accepted D1 map revision 1 (#4, `6221df4354e04ebfde3e903d33480765994f8aa7`) and economy revision 1 (#7, `0f1aad18a43ee6272faf507e2a10d80248011c90`). A03/A05 generation subset; no proposed D2/D3 rule is encoded.

## Implemented artifact and replay contract

`generateDepositMap(serverIssuedSeatsInAdmissionOrder, seed)` returns sector assignment, core/reserved-spawn coordinates, zero starting balances and deposit positions/types/payouts for 2–5 seats. It is a server-side complete map artifact, not a public state view: future room integration must apply the per-seat visibility boundary before sending it. It does not change the E1 fixed movement fixture or make a playable match.

Values are in `shared/src/config.ts`, revision `d1-deposits-mulberry32-r1`. Exact owned budgets are eight small / two large (160 scrap); the odd-player unowned sector has twelve small / four large (280). Whole-map totals are 320/760/640/1080. One owned template is mirrored about local coordinate 23 to the D1 core offsets; counts, types, payout and full placement geometry are identical after undoing mirrors. Core and all four neighbors are reserved. Deposits remain in local 2..21, off Belt, with the accepted small 2/4/2 distance bands and large 1/1 bands.

Engineering pins these previously unspecified generation choices for review:

- Sector assignment retains its own pinned seed stream unchanged. A separate deposit Mulberry32 revision-1 stream restarts at the same seed. Owned template attempts consume it first, followed by unowned attempts; no per-seat random draws.
- Canonical core is `(12,12)`. Candidate cells are enumerated row-major; each deposit draws `floor(next() * available.length)` without replacement. Bands are small 3–4 ×2, 5–7 ×4, 8–10 ×2, then large 5–7 ×1, 8–10 ×1. Unowned draws twelve small then four large from the same interior, excluding chosen cells.
- Owned verification flood-fills from **each** core-adjacent start in a conservative local 1..22 traversable square with core/deposits blocking. Every deposit needs a reachable cardinal firing tile within eight; at least one small is within four path steps. This conservatively excludes every edge even where the actual outer edge is safe, so the template works in all mirrors.
- Unowned verification starts only at borders shared with another sector, with Belt down. It uses the union of those reachable entry paths, never a world-edge entry. No phantom core is reserved there.
- At most sixteen attempts per template; each attempt has finite 400-cell candidate enumeration and 576-cell traversal bounds. At most 416 deposit draws are possible (160 owned + 256 unowned), separate from assignment. On exhaustion, fixed explicit owned/unowned templates are validated before use; invalid fallback fails closed. A bounded `attemptLimit` 0..16 permits deterministic forced-fallback fixtures. Record it as part of configuration; changing it can change the unowned stream. Default is sixteen.

Replay records `configRevision`, `seed`, `generation.attemptLimit`, admitted seat order, attempts and fallback flags. QA/Design should accept or revise these exact technical choices before runtime integration. No independent acceptance is inferred from author tests.

## Verification receipt

Code candidate `a1cba0f7dfafe0aa7fff9b443a4a5d2a83170ad0` on `engineer/e3-seeded-deposits-20261005`; base refreshed through merged E1 repair #41 at `3357587e7bdb5203b3ead110965fe84f5bf67834`. Claim `refs/heads/engineer/claim-e3` at `63d448026821e1575c429622d93910569af3c5c2`; owner `codex-engineer-lead-map-20261005`. Date 2026-10-05 UTC, managed Linux, Node 24.21.0/npm 11.19.0, system Chromium 151.0.7922.173, loopback without injected latency. Final source review moved owned bands into shared configuration and validates fallback counts/bands against it, retaining the same current seed outputs. Affected checks were repeated; later documentation commits do not change code.

| Check | Actual result |
|---|---|
| `npm ci`, format/lint/typecheck | Passed with pinned toolchain |
| New generation tests | 24 cases passed; four layouts ×68 seeds, plus forced fallback in every layout and invalid-input/replay checks |
| Independent test traversal/rays | Every deposit reachable; near-small firing path ≤4; core/neighbors/Belt excluded; exact mirrors, counts, bands and budgets pass |
| Separate Python uint32/candidate enumeration | Seed 42 canonical owned cells `(9,13),(8,12),(14,16),(9,14),(13,8),(18,12),(7,8),(19,14),(15,16),(21,11)`; next unowned cell `(21,6)` matches generated slot-4 world `(45,30)`; pinned in tests |
| `npm run test:unit` | 214 passed |
| `npm run test:integration` | 109 passed after refreshing E1 repair; independent QA probes unchanged |
| Two builds/manifest comparison and `npm run smoke:artifact` | Passed on clean final source candidate `a1cba0f7dfafe0aa7fff9b443a4a5d2a83170ad0` |
| Built system Chromium / documentation / phase-claim checks | 11 browser journeys passed on final source candidate; documentation/whitespace and three phase-claim checks passed; required exact-head CI tracked on PR |

The traversal tests implement their own coordinate-key BFS and rays, not the generator's validation helper. They check received map data as pure output, not a rendered approximation. These are developer tests, not independent QA Q2 or Design balance observations. No safe server capacity is measured. Local pinned browser download is denied by CDN HTTP 403; required PR CI supplies its own exact-head browser evidence.

## Phase readiness and concrete next owners

| Phase | Current next input / owner |
|---|---|
| E1 / G1 | Repair #41 is merged with green three-browser CI. QA #32 retests complete transport evidence; Design #38 accepts observed controls / reviews original #39 trace. Gate remains open. |
| E2 / G2 | Maintainer supplies approved Atlanta/New York host access, DNS/Tunnel configuration, deploy identity/status token binding and budget. Actual provisioning, HTTPS/WSS and restore drill remain unverified. Local source tooling alone cannot prove host delivery. |
| E3 / G3 | QA/Design review this map artifact/replay/config. Integrated room clock/harvest/build needs an accepted room candidate; death/respawn and reveal boundaries need accepted D2 decisions. This preparation closes no gameplay gate. |
| E4 / G4 | Engineering/QA disposition of D2 #29 plus integrated E3; independent full-match Q3 follows. Proposed combat/timer/lifecycle rules must not silently become accepted through implementation. |
| E5/E6 / G5 | Engineering/QA disposition of D3 #33, accepted D2 lifecycle where needed, E2 services for regional rollout, E4 lifecycle for bot/spectators. Design D4 needs the qualified playable candidate. |
| E7 / G6 | Earlier accepted runtime slices, target-host capacity/soak/recovery evidence, D4 feedback and independent Q5/Q6; maintainer owns release. |

Next review checkpoint: QA independently inspects all layouts/seed oracles/fallback and Design checks D1 intent; maintainer records accepted artifact. The Engineering lead stops at these review/access boundaries instead of declaring complete phases or implementing proposed product rules. Further work begins from a fresh main/issue/claim check after those inputs arrive. No merge, auto-merge, release, deployment or infrastructure mutation was performed by this map package.
