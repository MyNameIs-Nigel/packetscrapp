# Q0 review of the E1 technical supplement

Status: independent QA review recorded for [#19](https://github.com/MyNameIs-Nigel/packetscrapp/issues/19). This is not a runtime Pass, not Design acceptance, and not **Verified** for G0 or G1. The reviewer did not author [#13](https://github.com/MyNameIs-Nigel/packetscrapp/issues/13) or [#15](https://github.com/MyNameIs-Nigel/packetscrapp/pull/15).

## What was compared

Review date: 2026-10-04. Base: `3f5458aceadf7960cc8da121aba2c6c20ec124ca` (current `main` when claimed). Sources:

- [E1 handoff](../engineer/E1_HANDOFF.md), including the technical-decision table and E1.1–E1.3 slices
- [Q0/Q1 catalog](Q0_Q1_PLAN.md) cases F01–L01
- Accepted [D1 movement and map contract](../GAME_DESIGN.md#d1-movement-and-map-contract--revision-1) and [D1 UI wireframes](../design/D1_UI.md)
- Canonical [health schema](../REGIONS_AND_HEALTH.md#the-health-endpoint)
- Merged Mulberry32 revision 1 in `shared/src/random.ts`, with the reference vectors already in `tests/unit/determinism.test.ts`

[#15](https://github.com/MyNameIs-Nigel/packetscrapp/pull/15) merged the supplement while its “Independent prerequisite/technical review accepted” checkbox was still open. This record is the QA column of that review. It does not re-certify the E0 command evidence in [#15](https://github.com/MyNameIs-Nigel/packetscrapp/pull/15), and it does not execute E1.

## Disposition

| Supplement row | QA result | Oracle used for later execution |
|---|---|---|
| Replay stream | Oracle accepted | Mulberry32 revision 1 and seeds `0`, `1`, `42`, `4294967295`, as already implemented. Invalid and fractional seeds fail. The generator stays out of identity and token code. |
| Sector assignment | Exact seat permutation **Ready** after Engineering pin #21; runtime still Blocked on E1.2 | Zero-based row-major indexes, Durstenfeld `j = floor(next() * (i + 1))` descending, and worked examples are in the handoff and `assignSectorSlots`. This review's original blocker is addressed by that later Engineering package; independent QA still rechecks the vectors. |
| Identity and name | Oracle accepted for E1.1 | Strip U+0000–001F and U+007F–009F, NFC, trim, then 1–16 Unicode code points; reject overlength instead of truncating. Server identity only. Render as text. |
| Movement payload | Oracle accepted | Exact `direction` enum or `none`. Extra or forged fields do not change the stored intent. One intent per seat. |
| Key focus | Oracle accepted | Restates accepted D1 and the D1 UI: WASD and arrows match; latest held direction wins; release, blur, hide, and disconnect clear. Gameplay keys apply only on the focused game surface. |
| Tick time | Oracle accepted | 15 Hz integer ticks. One tile on even ticks only. Client timestamps do not advance the sim. Interpolation draws received tiles. |
| Health and protocol | Approach accepted; execution waits for E1.3 | Canonical `version` and `protocol` from the health document. Leaving E0's `sha` / `protocolVersion` requires protocol 2 and simultaneous client/fixture updates. H01 is not a pass against today's E0 payload. |
| Capacity and origins | Oracle accepted | Positive `MAX_ROOMS` (provisional 20), five seats, 20 concurrent connections per transport peer IP, exact configured origins. SDK tests use an explicit test admission policy. `status: ok` may coexist with `accepting: false`. |
| Message limits | Approach accepted; name the window anchor before A02 | 1 KiB frames rejected before parse; at most 30 accepted actions per window; the 31st is dropped; two consecutive windows over 60 frames disconnect only that connection. |
| Logs | Oracle accepted | Structured type, environment, region, and SHA. Names, full payloads, addresses, and tokens stay out of logs. |

## Sector assignment pin follow-up

The original #19 review blocked M03's exact permutation until Engineering named the index origin and Fisher–Yates formula. [#21](https://github.com/MyNameIs-Nigel/packetscrapp/issues/21) supplies that pin: zero-based row-major slots, center-column candidates `[1, 4]` for five players, Durstenfeld descending `j = floor(next() * (i + 1))`, and recomputable unit vectors including five players / seed `42` → unowned `4`, owned `[1, 0, 5, 3, 2]`.

This Q0 document remains the #19 review record. It does not re-run an independent QA oracle check of #21; that belongs to a later QA reading of the pin or to M03 execution. Geometry checks from D1 stay Ready. Map-generator retries and deposit placement stay in the economy contract for E3/Q2.

## Other bounds that stay testable

Nickname counting: the start-page wireframe says “1–16 characters”. The handoff counts Unicode code points after stripping and NFC. J02 uses that code-point procedure, including rejection of a 17-code-point name and of a control-only name. A later Design change to grapheme clusters would be a D3 contract revision. It is not an unowned E1.1 gap, and this review does not rewrite the wireframe.

Movement evidence: M01's browser half uses the handoff's labelled local movement prototype and battle-view fixture. The ordinary waiting room remains roster-only. Tick numbers are D1 match ticks, so tick 2 moves one tile and odd ticks do not. M01 does not require a Quick Play start.

Belt classification was missing from M02 even though D1 example 1 and E1.2 require it. The catalog now expects a successful step from `(22, 11)` into Belt cell `(23, 11)` on an even movement tick, lethal classification in that same tick, and a facing update. Respawn, scrap drop, and any arrival at `(24, 11)` during build are not E1 passes.

Rate limits: “per-connection”, “fixed”, and “reset” describe a tumbling one-second window owned by the connection, not a sliding window and not a shared process counter. They do not say whether the window opens at accept time or at the first counted frame. Engineering names that anchor in the E1.3 change. QA executes catalog case A02 against the recorded anchor and does not choose it here. E1.1 admission does not need the anchor.

J01 checks five seats and sixth-seat rejection inside one waiting room. It does not accept a 15-second lobby, host start, or bot. Those remain D3/E5.

## Gate effect

G0 stays open. D0/D1 source acceptance in [#3](https://github.com/MyNameIs-Nigel/packetscrapp/pull/3) and [#4](https://github.com/MyNameIs-Nigel/packetscrapp/pull/4) is unchanged. This review supplies the missing QA reading of the supplement and splits case readiness in the catalog. The maintainer still records whether the accepted oracles above clear E1.1 to start under [#14](https://github.com/MyNameIs-Nigel/packetscrapp/issues/14). Design control review of an implemented client remains a G1 checklist item, not something this document can sign.

G1 stays blocked on implementation plus independent execution. F01–F03 stay E0 evidence only.

## Next owners

| Need | Owner | Unblocks |
|---|---|---|
| Independent QA recheck of the #21 sector-assignment vectors against the handoff | QA | Confidence that M03 oracles match the published pin |
| Record whether the QA oracles above authorize E1.1 admission work | Maintainer, on #14 | E1.1 start |
| Change nickname counting only if code points are the wrong player rule | Design, at D3 nickname validation | A revised J02 oracle |
| Implement E1.1–E1.3 and execute Q1 on one immutable candidate | Engineering then QA | G1 evidence, still with Design control review |

No product rule was changed in this review.
