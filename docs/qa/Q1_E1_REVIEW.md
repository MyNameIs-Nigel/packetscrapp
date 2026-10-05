# Independent Q1 execution of merged E1

Status: **Blocked** under [#32](https://github.com/MyNameIs-Nigel/packetscrapp/issues/32). H02 fails the exact-origin preflight contract; Engineering owns [#34](https://github.com/MyNameIs-Nigel/packetscrapp/issues/34). G1 is not Verified. This QA run did not author or fix E1 product behavior.

CI receipt supersedes any inference of complete V01 acceptance below: [run 37250690815](https://github.com/MyNameIs-Nigel/packetscrapp/actions/runs/37250690815) on QA head `f68ebdd20780330095f3fde12996a2c8021d4a4d` passed repository checks, formatting/lint/types and unit tests, but integration returned **106 passes / 2 failures**. H02 reproduced; the existing V01 raw-byte positive control also failed (`deposit-2` absent from captured bytes), although decoded-state assertions and the new four-layout probe passed. Browser/build/artifact CI steps were skipped after failure. [#36](https://github.com/MyNameIs-Nigel/packetscrapp/issues/36) records the unresolved evidence-capture problem. Local V01 results below remain local results; transport acceptance is **Blocked**, not Pass.

The recorder in `startPrototype` attaches after `seat()` waits for welcome; an initial state can arrive before capture starts. This is a suspected capture race, not proven privacy disclosure or an established root cause. Engineering supplies fixture lifecycle evidence/correction; QA rechecks initial-state plus patch capture with own-sentinel positive controls and hidden-sector negative controls intact. No repeated CI run was used to dismiss the failure.

## Candidate and procedure

Executed 2026-10-05 UTC against merged implementation `c83da08091bf73cb4733e71ca63fdd7f3db23fb2`, initially clean in an isolated checkout. Contract: accepted D1 movement/map revision 1, E1 handoff and Q0 reviewed oracles; protocol 2. Linux cloud runtime, Node 24.21.0/npm 11.19.0, Chromium 151.0.7922.173 (system executable, not Playwright's pinned browser). All traffic was loopback with no added latency. No deployed service, real player data or public disruption was used.

Baseline commands ran before adding the QA probes. Existing suites were read against the contracts and independently executed; their test authors remain Engineering. New probes add coverage for missing-Origin preflight, initial decoded visibility across all four layouts, and a connection-window anchor of 137 ms. They use real HTTP and SDK transport, never mocked room handlers. Expected slots for seed 42 come from the independently recomputed Q1 oracle table, not `assignSectorSlots` output.

Commands use the isolated pinned toolchain on PATH; npm cache is in `/workspace/qa-tools/cache`. Browser invocation sets `PACKET_CHROMIUM_EXECUTABLE=/usr/bin/chromium`.

| Command / layer | Actual result |
|---|---|
| `npm ci` | Pass, exact lockfile; install warnings recorded for esbuild/msgpackr optional install scripts; successful build below demonstrates the available build binary |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Pass on the baseline; final QA changes checked separately |
| `npm run test:unit` | Pass: 190 tests, 10 files |
| `npm run test:integration` before QA probes | Pass: 105 tests, 8 files |
| `npm run build` twice, `cmp` complete manifests | Pass: identical clean-candidate local artifacts |
| `npm run smoke:artifact` | Pass: bare server health/join, origin/version and configuration refusals |
| `npm run test:e2e -- --project=chromium` | Pass: 11 built-client journeys, 34.5 seconds, two independent contexts where required |
| `npx playwright install chromium firefox webkit` | Blocked: CDN HTTP 403 `Domain forbidden`; no independent pinned Chromium/Firefox/WebKit result |
| `npx vitest run tests/integration/qa-q1-independent.test.ts` | Fail: 1 failed / 2 passed; missing-Origin H02 regression stays failing |
| Final `npm run test:integration` with QA probes | Fail: 107 passed / 1 failed in 9 files; only H02 fails |
| Final documentation, whitespace, formatting, lint, types and phase-claim helper checks | Pass; three claim-helper tests passed |

Baseline manifest SHA is the implementation SHA above, `dirty: false`, environment `local`, protocol 2. Artifact SHA-256 digests:

| Artifact | Digest |
|---|---|
| `client/assets/index-BwQ76xi6.js` | `6a820d26c2531f2ebe137e7d837cfb665f2d512ce3a64e03ad8230655e46fe97` |
| `client/index.html` | `97c76edeb0a6314b654aed198beecbeee12861892b5bd950cc48234fd5250db2` |
| `server/server.mjs` | `6b4fbab987c32281e1bd0119a97cd5877cafc6e25f1d8f463eb8f25c8dd85ef3` |

QA evidence/test commits are separate from that implementation candidate. Added tests change no runtime source or protocol. They are included in the normal integration command and required CI; no skip, quarantine, expected-failure marker or check suppression hides the defect. The draft PR is a blocked handoff, not a merge recommendation.

## Case dispositions

| Case / acceptance IDs | Disposition and limits |
|---|---|
| F01–F03 / A14 | Pass for local E0 subset: pinned install/checks, stale-output regression, repeated manifests and bare artifact. Development/production deployment remains unverified. |
| J01–J02 / A02/A12 | Pass for waiting admission, names, identity, five seats/sixth refusal and browser text rendering. Quick Play/private-host/bot flows are excluded. |
| M01–M03 / A02/A03 geometry | Pass for deterministic pure/SDK movement, all 16 seed/count vectors and local prototype boundaries; Chromium movement agrees between contexts. Real economy/map generation remains Q2. |
| K01 / A02 | Pass for tested Chromium key/focus/blur/hidden/disconnect paths; full browser matrix Blocked. Hidden-document test dispatches a controlled visibility event, not OS-level background throttling. Reconnect remains E5. |
| V01 / A04/A12 | Pass for E1 serialized fixture subset: existing raw-byte sentinel suite plus independent initial decoded checks and server-hook reveal for 2/3/4/5 players, seed 42. Actual phase clock, spectator/reconnect roles remain later work. |
| A01–A02 / A12 | Pass for tested malformed/oversize/flood cases. Independent nonzero-anchor test confirms the 31st frame drops at global 1000 ms and accepts at connection age exactly 1000 ms; two ticks move to `(13,10)`. |
| H01 / A11/A14 | Pass for local canonical health/readiness/capacity and bare artifact. TLS, proxy topology and drain are excluded. |
| H02 / A11/A12 | **Fail**: no-Origin OPTIONS returns 204. Wrong-Origin POST/upgrade, exact-Origin and peer-cap cases passed. |
| L01 / A02/A12 | Pass for tested repeated joins/leaves, disposal/counters and input cleanup; independent layout probes also dispose to zero rooms. Reconnect seat retention is excluded. |

These are case/subset results, not complete A01–A14 row acceptance or a full phase pass. Product timings, two networks/devices, operational capacity and release smoke were not run.

## Defect and cross-team handoff

**Q1-H02-01 / #34:** send `OPTIONS /matchmake/joinOrCreate/match` with `Access-Control-Request-Method: POST` and no Origin to the real server. Expected 403 with no allow-origin; actual 204, allow-origin `http://127.0.0.1:5173` and allow-credentials `true`. Exact-origin 204 and wrong-origin 403 controls passed. `installHttpGate` only refuses a defined wrong Origin in this branch. Reproduce with the targeted QA test command above.

Severity: Major contract deviation; the hard acceptance failure blocks H02/G1. No unauthorized mutation or browser exploit was demonstrated: POST and upgrade missing-Origin rejection pass, and OPTIONS creates no rooms. Engineering supplies the fix and adjacent regression; QA retests missing/wrong/exact/duplicate/null Origin, no-Origin health probes and built-client admission on the fixed immutable candidate.

| Remaining input | Owner / next action |
|---|---|
| H02 correct preflight rejection | Engineering, #34; supply fixed SHA for QA retest |
| V01 reliable initial raw-frame evidence | Engineering/QA, #36; resolve CI positive-control failure before transport acceptance |
| Independent required browser matrix | QA with environment/maintainer support; resolve CDN denial or run this QA candidate in supported CI; Engineering's prior browser CI is separate evidence |
| Observed control acceptance | Design; review the built E1 candidate and record approval on #14 |
| D2 revision 2 contract acceptance, E3/E4 gameplay | Design/Engineering; Q2/Q3 runtime entry is unavailable |
| D3 journeys, E5/E6 integration | Design/Engineering; Q4 runtime entry is unavailable |
| E2 development services, access and target-host capacity | Engineering/maintainer; Q5 drills and Q6 release entry are unavailable |

Q0 already has baseline/oracle reviews; its existing remote claim belongs to another run and was not altered. D2 #29 is a proposed contract with acceptance still open. This package stops at its Engineering/Design handoff; it does not substitute QA execution for their fixes or sign-off.
