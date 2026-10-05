# Development and shared-gate audit

Current QA addendum (2026-10-05): [independent Q1 E1 execution](qa/Q1_E1_REVIEW.md) under [#32](https://github.com/MyNameIs-Nigel/packetscrapp/issues/32) repeats the merged E1 baseline on `c83da08091bf73cb4733e71ca63fdd7f3db23fb2`. H02 fails missing-Origin preflight; Engineering owns [#34](https://github.com/MyNameIs-Nigel/packetscrapp/issues/34). G1 remains Blocked on the fix/retest, independent browser coverage and Design control review. Earlier evidence below remains candidate-specific.

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
| E1 authoritative connected-room slice | Branch `claude/vigilant-bardeen-wnttwl`, candidate `d32adfc5ea08402ce070895fcf89828bc8702730`; [implementation record](engineer/E1_EVIDENCE.md) under [#14](https://github.com/MyNameIs-Nigel/packetscrapp/issues/14) | Implemented and **In review** in [PR #31](https://github.com/MyNameIs-Nigel/packetscrapp/pull/31). Developer and CI evidence: admission, 15 Hz movement, per-seat views, limits, canonical health, structured logs, and browser journeys in Chromium, Firefox and WebKit with CI green. Not independent Q1, not Design-reviewed. |
| E2–E7 / Q1 gameplay–Q6 | Phase plans | Planned; no matches, regional deployment or release evidence. |
| Full D2 combat/lifecycle/UI proposal | [#29](https://github.com/MyNameIs-Nigel/packetscrapp/issues/29), [full-phase handoff](design/D2_HANDOFF.md), combat/lifecycle revision 2 and duration/UI revision 1 | In review. All four contract packages delivered as proposals; supersedes #26/#28 where stated. Independent Engineering/QA acceptance and runtime evidence pending. |
| Complete D3 player journey proposal | [#33](https://github.com/MyNameIs-Nigel/packetscrapp/issues/33), [journeys](design/D3_JOURNEYS.md), [handoff](design/D3_HANDOFF.md) | In review; all four specification packages proposed. Engineering/QA acceptance and E5/E6/Q4/D4 runtime evidence pending. |
| D2 duration paper calculation | Proposed immediate ring 0 and 30-tick cadence in [GAME_DESIGN.md](GAME_DESIGN.md#d2-phase-boundaries-and-finite-duration--revision-1) | 5:22/5:46 simulated upper bounds, excluding lobby/results. Paper coverage only; changed values await acceptance and runtime Q3. |

## Shared gates

| Gate | Current state | Exact next evidence / accountable owner |
|---|---|---|
| G0 contracts ready | Open; QA supplement review and sector-pin recheck recorded | D0/D1 acceptance recorded. [Q0_REVIEW.md](qa/Q0_REVIEW.md) accepted most oracles; #21 pins sector assignment; [Q1_SECTOR_PIN_RECHECK.md](qa/Q1_SECTOR_PIN_RECHECK.md) independently rechecks those vectors. Maintainer records E1.1 clearance on #14; G0 is not Verified. |
| G1 connected foundation | Blocked: Q1 H02 failure | [Independent Q1 review](qa/Q1_E1_REVIEW.md) reproduces missing-Origin preflight failure on merged E1; Engineering fixes #34, QA retests. Independent browser matrix and Design control review remain open. Prior Engineering CI is separate evidence. Not Verified. |
| G2 development delivery | Planned; access unverified | E2 actual isolated HTTPS/WSS, same candidate on the Atlanta development server and client, failed-rollout restore and Q5 evidence; maintainer supplies access. E2 preparation can run during E1. |
| G3 build loop | Planned | E3/Q2 all player counts, resources/purchases/privacy/timers and Design review. Accept proposed D2 revision 2 before the build-death/respawn slice. |
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
| Exact seed stream, admission/input bounds, prototype fixture scope and health schema transition | Implemented in E1 (protocol 2); decisions recorded in [E1_EVIDENCE.md](engineer/E1_EVIDENCE.md); QA/Design review under #14 | Engineering/QA, maintainer coordinates |
| Economy/radius/generation/UI | D1 contracts merged; full runtime qualification at E3/Q2 | Design/Engineering/QA |
| Hull healing, beam priority, turret targeting/ties, simultaneous deposit credit | Proposed full D2 combat revision 2 under #29; Engineering/QA acceptance required before E4 encoding | Design; Engineering/QA review |
| Contenders, core-loss during respawn/disconnect, win/same-tick draw | Proposed full D2 lifecycle revision 2 under #29; Engineering/QA acceptance required before E3 death slice / E4 | Design; Engineering/QA review |
| Sudden-death duration / finite match bound | D2 #29 supplies proposed 5:22/5:46 paper bounds; cadence and boundary acceptance plus Q3 runtime evidence remain open | Design and Engineering; freeze at dependent slice entry |
| Host/bot/reconnect/spectator journeys | D3 revision 1 proposed under #33; exact message/identity and oracle acceptance required before dependent E5/E6 slices | Engineering/QA review; maintainer coordinates |
| Hosting/Tunnel/SSH/Atlanta builder, credentials, budget | E2 access/provisioning unverified; no E1 local blocker | Maintainer and Engineering; resolve before E2 application deployment |
| Operational workload and safe capacity | Q0 provisional targets documented; actual measurements required before E7/G6 | Engineering/QA; qualify on intended hosts |

E1's immediate implementation inputs are present. Integrating and reviewing #13 closes the prerequisite handoff; #14 is the next development package. Keep G1 open until actual authoritative movement and independent evidence satisfy its checklist.

## E1 implementation

Recorded under [#14](https://github.com/MyNameIs-Nigel/packetscrapp/issues/14) in [E1_EVIDENCE.md](engineer/E1_EVIDENCE.md), against implementation candidate `d32adfc5ea08402ce070895fcf89828bc8702730` (Node 24.21.0, npm 11.19.0, Chromium 141). Engineering delivered E1.1 admission, E1.2 movement with the labelled local prototype, and E1.3 limits, views, health and logs together. Local results on the clean candidate: format, lint, types, 190 unit tests, 105 real-SDK/bundle integration tests, 11 built-Chromium journeys, identical repeated manifests, and bare-bundle smoke for local, development and production artifacts. Protocol is now 2: `/health` reports the canonical `version` and `protocol` fields. This is the implementing team's evidence. CI on [PR #31](https://github.com/MyNameIs-Nigel/packetscrapp/pull/31) ([run 37249493014](https://github.com/MyNameIs-Nigel/packetscrapp/actions/runs/37249493014)) passed all checks, including 33 built-browser tests across Chromium 153, Firefox 155 and WebKit 26.6. No independent or Design verification exists; E1 is therefore **In review**, not Verified. The window anchor, frame allowlist, HTTP-status refusals and the matchmaking-reservation risk that QA and Design should review are listed in the record.

## Q0 supplement review

Recorded 2026-10-04 under [#19](https://github.com/MyNameIs-Nigel/packetscrapp/issues/19) in [Q0_REVIEW.md](qa/Q0_REVIEW.md), against base `3f5458aceadf7960cc8da121aba2c6c20ec124ca`. This addendum is the QA reading of the supplement merged in [#15](https://github.com/MyNameIs-Nigel/packetscrapp/pull/15). It does not replace the E0 evidence above, and it does not mark G0 or G1 **Verified**.

The G0 row's next evidence is now that review, not an unstarted reading of #13. QA accepted test oracles for the replay stream, admission, movement payload, focus, even-tick movement, health-field transition, capacity/origins, message-limit approach, and log redaction. Exact sector-assignment replay is pinned under [#21](https://github.com/MyNameIs-Nigel/packetscrapp/issues/21) (zero-based indexes, Durstenfeld revision 1, worked examples and `assignSectorSlots`). Independent QA rechecked those vectors under [#23](https://github.com/MyNameIs-Nigel/packetscrapp/issues/23) in [Q1_SECTOR_PIN_RECHECK.md](qa/Q1_SECTOR_PIN_RECHECK.md). The maintainer records whether the accepted oracles clear E1.1 under #14. Q1 execution still waits for an E1.1–E1.3 implementation candidate.

## E1 sector-assignment pin

Recorded under [#21](https://github.com/MyNameIs-Nigel/packetscrapp/issues/21). Engineering pins zero-based row-major slot indexes, Durstenfeld Fisher–Yates revision 1, and unit oracles in [E1_HANDOFF.md](engineer/E1_HANDOFF.md) plus `shared/src/sectorAssignment.ts`. This clears the M03 exact-permutation documentation blocker from the Q0 review. It is not room admission, movement, or G0/G1 verification.

## Q1 sector-assignment pin recheck

Recorded under [#23](https://github.com/MyNameIs-Nigel/packetscrapp/issues/23) in [Q1_SECTOR_PIN_RECHECK.md](qa/Q1_SECTOR_PIN_RECHECK.md), against pin candidate `f93684523cf4562155f477d1caebf96fac6bae20`. Independent Python uint32 recomputation matched the handoff worked examples and all sixteen published vectors without copying TypeScript helper output. M03's exact-permutation oracle remains Ready; runtime stays Blocked on E1.2. Next: maintainer E1.1 clearance on #14, then E1.1 implementation.

## D2 combat collision and targeting proposal

Recorded under [#25](https://github.com/MyNameIs-Nigel/packetscrapp/issues/25). Design proposes revision 1 of the [combat collision and targeting contract](GAME_DESIGN.md#d2-combat-collision-and-targeting-contract--revision-1): cardinal beam blockers/pass-through, Chebyshev turret range with LOS and seatIndex ties, seat-ordered damage/last-hit credit, pickup merge rules, and hull-upgrade healing equal to the max-HP bonus. Status: **In review** / proposed — not yet accepted by Engineering/QA and not runtime-verified. Contender rules are a separate proposal below. Sudden-death duration and combat UI remain later D2 packages. E1.1 clearance on #14 is unchanged.

## D2 contender and win-draw proposal

Recorded under [#27](https://github.com/MyNameIs-Nigel/packetscrapp/issues/27). Design proposes revision 1 of the [contender and win-draw contract](GAME_DESIGN.md#d2-contender-and-win-draw-contract--revision-1): `alive` / `awaiting_respawn` / `permanently_eliminated` roles; disconnect grace keeps contender status until expiry eliminates without respawn; core loss during respawn wait eliminates immediately; win when `|C|=1` (including sole awaiting respawn); same-tick empty `C` draws among seats that left this tick. Status: **In review** / proposed — not yet accepted by Engineering/QA and not runtime-verified. D2 package 3 still owns the finite sudden-death duration proof.

## Design review checkpoint — 2026-10-05

Current upstream base `c83da08091bf73cb4733e71ca63fdd7f3db23fb2` includes merged #30 (D2 proposal) and #31 (E1 implementation); earlier “In review” implementation/PR wording above is historical, not an assertion that those PRs remain open. Merge does not supply independent rule/control acceptance. Q1 is actively owned under [#32](https://github.com/MyNameIs-Nigel/packetscrapp/issues/32); G1 still needs independent Q1 and Design control review. No live game, region deployment or release is verified.

D3's [complete proposal](design/D3_JOURNEYS.md) under #33 delivers all four documented contract packages, including host/BOT permissions, bound reconnect identity, external watcher versus former-player capacity, replay, region/list recovery and J01–J20 expected scenarios. Author checks are specification consistency and links only. Next owners: Engineering/QA accept proposed decisions and exact transport mapping; Engineering supplies E5/E6; QA supplies Q4; Design conducts D4 only on qualified playable candidates. D5 waits for D4 and E7/Q6. No gate is marked Verified by this handoff.

## E1 Design control checkpoint — 2026-10-05

Design reviewed merged implementation `c83da08091bf73cb4733e71ca63fdd7f3db23fb2` under [#38](https://github.com/MyNameIs-Nigel/packetscrapp/issues/38). [Control review and visual observation](design/E1_CONTROL_REVIEW.md) support focus escape, blur stop, build hazard/display and prototype labelling, but **acceptance is Blocked**: system Chromium browser run passed ten cases and failed the final two-client convergence assertion. Engineering diagnoses [#39](https://github.com/MyNameIs-Nigel/packetscrapp/issues/39), a suspected snapshot race without established persistent product divergence; Design does not fix Engineering code/tests or call the failure a pass.

Independent QA also records [#34](https://github.com/MyNameIs-Nigel/packetscrapp/issues/34) missing-Origin preflight and [#36](https://github.com/MyNameIs-Nigel/packetscrapp/issues/36) raw-frame positive-control capture, in [draft #35](https://github.com/MyNameIs-Nigel/packetscrapp/pull/35). G1 remains open for Engineering evidence/fixes, QA retest and Design review of the affected controls on one immutable SHA. D4/D5 still require qualified gameplay/playtest/release inputs. No Design or shared gate is marked Verified by this receipt.

## Engineering E1 repair checkpoint — 2026-10-05

[Repair receipt](engineer/E1_REPAIR.md) records Engineering fixes for missing-Origin matchmaking preflight (#34), reliable initial raw-state capture (#36), and settled two-browser convergence/stop assertions (#39). Candidate `f47a20d4eab5fd953217ce0105264951f0b1e183` includes merged QA #35 and Design #40; 190 unit/109 integration checks and local built Chromium pass. This is developer evidence, not independent retest or Design acceptance. G1 remains open pending QA #32 and Design #38 on the repaired candidate. Historical failing evidence above is preserved; local pinned-browser downloads remain denied.

## Engineering lead checkpoint — 2026-10-05

Upstream was rechecked after E1 and map milestones. #41 is now merged (`3357587`), repairing #34 missing-Origin preflight and developer evidence capture/convergence for #36/#39; exact-head CI run [37252005945](https://github.com/MyNameIs-Nigel/packetscrapp/actions/runs/37252005945) passed both jobs and the pinned Chromium/Firefox/WebKit matrix. Independent QA #32 and Design #38 acceptance still remain open; merge does not close G1.

[E3 map preparation](engineer/E3_MAP_PREPARATION.md) under #42 supplies deterministic mirrored finite deposits, legal firing-path verification and bounded verified fallback. Candidate `a1cba0f7dfafe0aa7fff9b443a4a5d2a83170ad0` incorporates the E1 repair; 214 unit/109 integration tests pass. New developer geometry checks cover four layouts across 68 seeds and forced fallbacks. QA/Design review generation/replay choices before integration; no match, harvesting/building, death/respawn, G3 closure or balance observation is supplied. The receipt names review/access prerequisites for E2–E7; infrastructure delivery still needs maintainer access, and dependent combat/journey slices still need D2/D3 acceptance.
