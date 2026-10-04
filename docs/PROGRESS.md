# Development and shared-gate audit

Audit date: 2026-10-04 UTC. Repository base: `53c2357e39f57303df2c3095df2eafa0fb7fa26a`. Audit owner: Codex, working for maintainer @MyNameIs-Nigel under [#13](https://github.com/MyNameIs-Nigel/packetscrapp/issues/13). This record supersedes stale phase-summary wording; it does not replace the [gate criteria](DELIVERY_PLAN.md#shared-checkpoints).

## What is actually delivered

| Work | Evidence | State and practical meaning |
|---|---|---|
| D0 scope/entry revision 1 | Merged [#3](https://github.com/MyNameIs-Nigel/packetscrapp/pull/3), `807e43f15ac64109fc293943117e074867c2ebb3`; PR records Engineering/QA acceptance of measurement boundaries/examples | Accepted contract; product timings and comprehension remain unmeasured. |
| D1 movement/map revision 1 | Merged [#4](https://github.com/MyNameIs-Nigel/packetscrapp/pull/4), `6221df4354e04ebfde3e903d33480765994f8aa7`; PR records Engineering/QA contract review, including seed replay and unowned visibility | Accepted input for E1; no movement implementation. |
| D1 economy and UI revision 1 | Merged [#7](https://github.com/MyNameIs-Nigel/packetscrapp/pull/7), `0f1aad1`; [#6](https://github.com/MyNameIs-Nigel/packetscrapp/pull/6), `53c2357e39f57303df2c3095df2eafa0fb7fa26a` | Contracts delivered for later E3/Q2 and current focus requirements; no economy/client gameplay verification. |
| D4 playtest protocol | Merged [#5](https://github.com/MyNameIs-Nigel/packetscrapp/pull/5), `da5c7b2fa23ba9acc1acb285f8b97ad3b3e41329` | Preparation only; no playtests run. |
| E0 workspace/transport | Merged [#9](https://github.com/MyNameIs-Nigel/packetscrapp/pull/9), `3e416d387e86b98736f995d1b9d2422adba083fd`; [#8](https://github.com/MyNameIs-Nigel/packetscrapp/issues/8) remains open for independent acceptance | Implemented; original CI, independent clean-main checks and corrected audit candidate CI pass. New changes need independent review in [#15](https://github.com/MyNameIs-Nigel/packetscrapp/pull/15). |
| Q0/Q1 preparation | [Q0 baseline and case catalog](qa/Q0_Q1_PLAN.md), [E1 technical handoff](engineer/E1_HANDOFF.md), #13; E1 execution tracked in [#14](https://github.com/MyNameIs-Nigel/packetscrapp/issues/14) | Prepared for review; E1 cases Ready, execution Blocked until implemented. |
| E1–E7 / Q1 gameplay–Q6 | Phase plans plus #14 | Planned; no real game movement, matches, regional deployment or release evidence. |
| D2 combat collision/targeting revision 1 | Proposed under [#25](https://github.com/MyNameIs-Nigel/packetscrapp/issues/25) in [GAME_DESIGN.md](GAME_DESIGN.md#d2-combat-collision-and-targeting-contract--revision-1) | Proposed contract for Engineering/QA review; not accepted, not implemented. |

## Shared gates

| Gate | Current state | Exact next evidence / accountable owner |
|---|---|---|
| G0 contracts ready | Open; QA supplement review and sector-pin recheck recorded | D0/D1 acceptance recorded. [Q0_REVIEW.md](qa/Q0_REVIEW.md) accepted most oracles; #21 pins sector assignment; [Q1_SECTOR_PIN_RECHECK.md](qa/Q1_SECTOR_PIN_RECHECK.md) independently rechecks those vectors. Maintainer records E1.1 clearance on #14; G0 is not Verified. |
| G1 connected foundation | Blocked on E1 implementation | Complete #14's admission, pure/server movement, browser controls, validated transport/views/readiness, independent Q1 and Design control review against one SHA. Engineering implements; QA/Design verify. |
| G2 development delivery | Planned; access unverified | E2 actual isolated HTTPS/WSS, same candidate on the Atlanta development server and client, failed-rollout restore and Q5 evidence; maintainer supplies access. E2 preparation can run during E1. |
| G3 build loop | Planned | E3/Q2 all player counts, resources/purchases/privacy/timers and Design review. D2 build-death/respawn contract is still needed for that slice. |
| G4 complete match | Planned | Accepted D2 lifecycle, E4/Q3 deterministic combat, contenders, results and duration proof. |
| G5 player journeys | Planned | Accepted D3, E5/E6/Q4, actual D4 playtests and Design acceptance. |
| G6 launch | Planned | D5/E7/Q5/Q6 complete capacity, recovery, security, browser/network, rollback and release-candidate evidence; maintainer approval. |

## E0 audit evidence

Baseline acceptance checkout was clean at full SHA `53c2357e39f57303df2c3095df2eafa0fb7fa26a`, Linux cloud runtime, Node 24.21.0/npm 11.19.0, local loopback environment. `npm ci`, documentation, formatting, lint, types, eight configuration unit tests, one real SDK integration, build and bare-bundle health/SDK join passed. This independently repeats the original Engineering foundation; it does not verify E1 authority or gameplay.

GitHub Actions [run 37184966797](https://github.com/MyNameIs-Nigel/packetscrapp/actions/runs/37184966797) passed on original E0 candidate `34c61a07eea3529db66935dfb2039487126cf178`. The connector confirmed both jobs and every step, including pinned Chromium installation, built browser smoke, repeated manifest comparison and bare artifact verification. This is evidence for that candidate only.

**Defect found:** injecting `dist/server/obsolete-probe.txt` into the clean-main build made the next manifest include it. The new `artifact-build.test.ts` reproduced the failure before the fix. The builder now clears its generated output before emitting a candidate; the regression verifies identical complete manifests and removal of obsolete server/client output in an isolated Git fixture. The artifact smoke also checks missing configuration, invalid ports and runtime/build-environment mismatch. Seeded random reference vectors and a manual-clock fixture prepare deterministic E1 cases.

Current local Playwright browser download still returns HTTP 403 `Domain forbidden` from `cdn.playwright.dev`, even though the runtime reports that host as allowed. Record this environment discrepancy; do not call the pinned local browser tested. The original E0 CI pinned-browser result is valid; the audit uses system Chromium 151.0.7922.173 through a temporary executable-path override and records its result separately. Firefox/WebKit and cross-network product acceptance remain E1/Q4 work respectively.

Clean audit implementation candidate: `bca12a9d216fb7dd7e726510de301fa979cb6c10`, on `engineer/e1-prerequisites` in [PR #15](https://github.com/MyNameIs-Nigel/packetscrapp/pull/15). Fresh `npm ci`, documentation/whitespace, format/lint/types, 19 unit tests, two integration tests, built connection in system Chromium 151.0.7922.173, identical manifests from two builds, and bare-bundle join plus three configuration-rejection cases passed locally. No new dependency or protocol change was introduced.

GitHub Actions [run 37232734371](https://github.com/MyNameIs-Nigel/packetscrapp/actions/runs/37232734371) passed both jobs on that exact audit candidate, including pinned Chromium installation/browser smoke, repeated builds and standalone artifact checks. This resolves pinned-browser verification through CI; the local download discrepancy remains an environment limitation. This evidence receipt is a later documentation-only commit; its PR-head CI must still pass, and any subsequent implementation change needs affected tests again.

Dirty working-tree runs are development feedback only. New changes in this audit require independent review; this author cannot supply a second person's sign-off. Review #15's Q0 baseline and technical supplement to close G0, then implement #14 and collect Q1/Design evidence to close G1.

## Decision ownership and next checkpoints

| Decision | State / next checkpoint | Owner |
|---|---|---|
| Entry wording and timing boundaries | Accepted in #3; actual timing tested at E5/Q4 | Design/QA |
| Movement/map, facing, simultaneous collision, Belt-shot boundary and public roster | Accepted in #4; implement/test under #14 | Design/Engineering/QA |
| Exact seed stream, admission/input bounds, prototype fixture scope and health schema transition | Prepared in E1 handoff; review under #13 before implementation | Engineering/QA, maintainer coordinates |
| Economy/radius/generation/UI | D1 contracts merged; full runtime qualification at E3/Q2 | Design/Engineering/QA |
| Hull healing, beam priority, turret targeting/ties, simultaneous deposit credit | Proposed D2 combat contract revision 1 under [#25](https://github.com/MyNameIs-Nigel/packetscrapp/issues/25); Engineering/QA acceptance still required before E4 encoding | Design; Engineering/QA review |
| Build deaths, pending respawns, combat/tick ending, finite match duration | Remaining D2 packages still required before E3 death slice/E4 lifecycle | Design and Engineering; freeze at dependent slice entry |
| Host/bot/reconnect/spectator journeys | D3 still required before dependent E5/E6 slices | Design and Engineering; freeze at dependent slice entry |
| Hosting/Tunnel/SSH/Atlanta builder, credentials, budget | E2 access/provisioning unverified; no E1 local blocker | Maintainer and Engineering; resolve before E2 application deployment |
| Operational workload and safe capacity | Q0 provisional targets documented; actual measurements required before E7/G6 | Engineering/QA; qualify on intended hosts |

E1's immediate implementation inputs are present. Integrating and reviewing #13 closes the prerequisite handoff; #14 is the next development package. Keep G1 open until actual authoritative movement and independent evidence satisfy its checklist.

## Q0 supplement review

Recorded 2026-10-04 under [#19](https://github.com/MyNameIs-Nigel/packetscrapp/issues/19) in [Q0_REVIEW.md](qa/Q0_REVIEW.md), against base `3f5458aceadf7960cc8da121aba2c6c20ec124ca`. This addendum is the QA reading of the supplement merged in [#15](https://github.com/MyNameIs-Nigel/packetscrapp/pull/15). It does not replace the E0 evidence above, and it does not mark G0 or G1 **Verified**.

The G0 row's next evidence is now that review, not an unstarted reading of #13. QA accepted test oracles for the replay stream, admission, movement payload, focus, even-tick movement, health-field transition, capacity/origins, message-limit approach, and log redaction. Exact sector-assignment replay is pinned under [#21](https://github.com/MyNameIs-Nigel/packetscrapp/issues/21) (zero-based indexes, Durstenfeld revision 1, worked examples and `assignSectorSlots`). Independent QA rechecked those vectors under [#23](https://github.com/MyNameIs-Nigel/packetscrapp/issues/23) in [Q1_SECTOR_PIN_RECHECK.md](qa/Q1_SECTOR_PIN_RECHECK.md). The maintainer records whether the accepted oracles clear E1.1 under #14. Q1 execution still waits for an E1.1–E1.3 implementation candidate.

## E1 sector-assignment pin

Recorded under [#21](https://github.com/MyNameIs-Nigel/packetscrapp/issues/21). Engineering pins zero-based row-major slot indexes, Durstenfeld Fisher–Yates revision 1, and unit oracles in [E1_HANDOFF.md](engineer/E1_HANDOFF.md) plus `shared/src/sectorAssignment.ts`. This clears the M03 exact-permutation documentation blocker from the Q0 review. It is not room admission, movement, or G0/G1 verification.

## Q1 sector-assignment pin recheck

Recorded under [#23](https://github.com/MyNameIs-Nigel/packetscrapp/issues/23) in [Q1_SECTOR_PIN_RECHECK.md](qa/Q1_SECTOR_PIN_RECHECK.md), against pin candidate `f93684523cf4562155f477d1caebf96fac6bae20`. Independent Python uint32 recomputation matched the handoff worked examples and all sixteen published vectors without copying TypeScript helper output. M03's exact-permutation oracle remains Ready; runtime stays Blocked on E1.2. Next: maintainer E1.1 clearance on #14, then E1.1 implementation.

## D2 combat collision and targeting proposal

Recorded under [#25](https://github.com/MyNameIs-Nigel/packetscrapp/issues/25). Design proposes revision 1 of the [combat collision and targeting contract](GAME_DESIGN.md#d2-combat-collision-and-targeting-contract--revision-1): cardinal beam blockers/pass-through, Chebyshev turret range with LOS and seatIndex ties, seat-ordered damage/last-hit credit, pickup merge rules, and hull-upgrade healing equal to the max-HP bonus. Status: **In review** / proposed — not yet accepted by Engineering/QA and not runtime-verified. Contender, sudden-death duration, and combat UI remain later D2 packages. E1.1 clearance on #14 is unchanged.
