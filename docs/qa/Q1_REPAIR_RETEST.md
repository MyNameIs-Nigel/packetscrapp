# Q1 repaired foundation retest — 2026-10-17

Owner: Codex `codex-three-steps-20261017`, QA, under #32 and the maintainer's request to complete foundation verification, contract review and the first build loop. This run did not author E1, repair #41, map generator #43 or Design #44. Implementation candidate: `296479a1f1079b3fe656c8c7275e65a97a2f7595` (current main, includes all three). No product source, dependency, assertion, retry or timeout was changed for this retest. Historical failures remain valid for their original candidates.

## Executed acceptance

Linux managed environment, loopback without injected latency; Node 24.21.0/npm 11.19.0; protocol 2; accepted D1 map/movement/economy/UI revision 1. Seeds include 42 and the existing pinned vectors. Clean isolated checkout `/workspace/packetscrapp-qa`, branch `qa/e1-repair-retest-20261017`. Claim `qa/claim-q1` at `9ebb6faba2f7fa5ec118ec4b25f7aaa215d79231`.

| Command / criterion | Result |
|---|---|
| `npm ci --cache /tmp/packet-npm-cache --no-audit --no-fund` | Passed; lockfile unchanged |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Passed |
| `npm run test:unit` | 214 passed |
| `npm run test:integration` | 109 passed; real HTTP/SDK/serialized state |
| `PACKET_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --project=chromium` | 11 passed, 27.3 s; system Chromium 151.0.7922.173 |
| `npm run build` twice and `cmp` full manifests | Passed; clean candidate, identical artifacts |
| `npm run smoke:artifact` | Passed in empty temporary runtime: health, real SDK join, origins/versions/configuration refusals |
| `python3 scripts/check_docs.py`, `git diff --check` | Passed for review receipt |
| Pinned browser installation | CDN HTTP 403 `Domain forbidden`; local pinned Chromium/Firefox/WebKit unavailable. Exact-head PR CI must supply this matrix before final G1 disposition. |

F01–F03, J01–J02, M01–M03, K01, V01, A01–A02, H01–H02 and L01 in the Q0/Q1 catalog pass within their implemented E1 scope on this candidate, subject to the required CI browser matrix. A02/A04/A11/A12/A14 are foundation subsets, not complete launch rows.

## Defect disposition

- **#34 / H02: fixed and independently retested.** Missing/wrong/null/duplicate Origins are refused on the covered matchmaking/upgrade paths, exact-Origin controls join, and no-Origin health stays readable. The original independent missing-Origin regression passes unchanged.
- **#36 / V01: repaired evidence capture passes.** Raw capture attaches before welcome/state delivery; each of five clients must receive exactly one initial state, own sentinel positive controls and no foreign/unowned sentinel. Patches and battle reveal also pass. Independent decoded initialization/reveal probes pass for all four layouts. This resolves the recorded evidence defect; it does not claim the historical failure was a data leak.
- **#39: repaired convergence assertion passes.** Two built browser contexts make progress, stop before the edge and settle on identical server-owned state after release. Focus/blur/hidden/disconnect cases pass. The original trace remains unavailable; no persistent product divergence was established. Design's independent scoped acceptance is already recorded in [E1_CONTROL_REVIEW.md](../design/E1_CONTROL_REVIEW.md).

**G1 is Verified for the reviewed E1 candidate.** QA PR #54 head `3f0ac7570a2a17800aed1aa250f20d936e10a863` passed [CI run 39070700448](https://github.com/MyNameIs-Nigel/packetscrapp/actions/runs/39070700448): both jobs and every step, including pinned Chromium/Firefox/WebKit, SDK/unit checks, repeated manifests and bare smoke. CI validates the PR merge candidate against the dependency updates that reached main during this run. The local receipt above remains tied to its original SHA. Combined with Design's existing scoped control acceptance, this closes the G1 foundation criteria. Later implementation/protocol changes must rerun impacted checks. Merge, launch, deployed topology, performance, gameplay economy, reconnect and spectators are separate requirements. No self-approval of the later Engineering implementation is supplied.

## Next-slice contract oracle review

QA accepts the D1 map artifact's replay choices `d1-deposits-mulberry32-r1`: separate assignment/deposit streams, row-major candidate draws, owned then unowned generation, all mirrors, sixteen bounded attempts and forced verified fallbacks. Reviewed generator #43 and its tests against D1, then independently inspected raw output using [the Python oracle](evidence/check-deposit-corpus.py), which imports no game helper. Sixteen maps passed: counts 2/3/4/5 × seeds 0/42/4294967295, plus forced fallback for all counts. Checks cover exact budgets 320/760/640/1080, zero balances, unique/reserved cells, mirrored kind/distance signatures, cardinal firing paths and a small within four path steps. This is artifact acceptance, not Q2 integrated gameplay or Design balance acceptance.

Reproduce from the repository root with the pinned Node on PATH:

```sh
node --input-type=module -e 'import {generateDepositMap} from "./shared/src/depositMap.ts"; const corpus=[]; for(const count of [2,3,4,5]) for(const seed of [0,42,4294967295]) corpus.push(generateDepositMap(Array.from({length:count},(_,i)=>i),seed)); for(const count of [2,3,4,5]) corpus.push(generateDepositMap(Array.from({length:count},(_,i)=>i),42,{attemptLimit:0})); process.stdout.write(JSON.stringify(corpus));' > /tmp/packet-map-corpus.json
python3 docs/qa/evidence/check-deposit-corpus.py < /tmp/packet-map-corpus.json
```

QA accepts the merged Design #44 **D2 combat/lifecycle revision 2 and duration/UI revision 1** as observable rule oracles: cooldown-consuming misses, snapshot fire then ordered damage, wall-before-overlapping-ship priority, exact turret supercover/ties, hull healing, final-core-state death eligibility, blocked-spawn retry, one absolute absence deadline, abandonment without duplicate scrap, early-build privacy and contender-aware win/draw. Independent all-cell Python enumeration reproduced ending ticks 4830/5190/5190/5190 and disposal ticks 5055/5415/5415/5415 across 1,152/2,304/2,304/3,456 cells. Runtime Q2/Q3 and pacing observations remain unexecuted; no paper result substitutes for them. The maintainer's request to accept the remaining contracts authorizes the proposed immediate ring 0 and 30-tick cadence as implementation inputs, subject to review in the PR.

QA accepts **D3 revision 1 / J01–J21** as expected player outcomes: atomic lobby admission/start, exactly one solo bot, host transfer, fixed 300-tick recovery, former-player versus external-watcher capacity, strict role filtering including early results, fresh replay identity, region-bound links, stale-response rejection and keyboard recovery. Engineering must pin the supported payload/identity mapping before E5; J07's interrupted-ack/single-owner test remains mandatory. This is specification acceptance only. D3 transport code, Q4 journeys, bot quality and D4 human playtests remain unverified.

Engineering's separate feasibility/transport review and the Design D1 intent already expressed in the merged contracts remain the other inputs. This QA receipt accepts another author's specifications; it cannot independently approve code authored later in this same run.
