# E1 Origin and evidence repair

Status: **In review — Engineering evidence; QA/Design retest required.** Repairs [#34](https://github.com/MyNameIs-Nigel/packetscrapp/issues/34), [#36](https://github.com/MyNameIs-Nigel/packetscrapp/issues/36) and the assertion mechanism in [#39](https://github.com/MyNameIs-Nigel/packetscrapp/issues/39). G1 stays open. Sources: accepted D1 movement/map revision 1, D1 UI revision 1, [E1 handoff](E1_HANDOFF.md), Q0/Q1 catalog and exact-origin policy. Acceptance IDs A02/A04/A11/A12; protocol 2 unchanged.

## Diagnosis and changes

- Matchmaking OPTIONS with no Origin returned 204. The new real-HTTP regression failed with `expected 204 to be 403` before the fix. Matchmaking preflight now requires the exact Origin; GET health probes without Origin remain readable. Regression checks missing CORS permission headers, rejection counter, zero allocation and health availability. Merged QA's independent H02 reproduction also passes without modification.
- `startPrototype` attached raw capture only after `seat` awaited welcome. The last joining client can receive its initial build state before welcome resolves. `seat` now supports a synchronous capture callback immediately after the SDK's JOIN_ROOM promise resolves, before waiting for welcome. The pinned SDK 0.18.5 resolves that promise on JOIN_ROOM before initial state delivery (see `Client.consumeSeatReservation` and `Room` clock documentation). The callback runs before another await. Raw evidence now requires exactly one ROOM_STATE frame for each of the five clients, own sentinel positive controls, all foreign/unowned negative controls, and battle reveal. Waiting-room capture uses the same boundary.
- The final two-browser assertion froze Alpha's position immediately after Bravo's key release, then polled only Bravo against that frozen value. A final in-flight step can invalidate that value. It now compares both clients' settled state using the existing quiet-interval helper and explicitly checks upward progress, facing/alive, and stopping short of the top edge. No product movement change, retries, skips or increased timeouts.

The original Design trace path belongs to a different workspace and is unavailable here; its recorded failure remains valid. Five diagnostic executions of the original assertion passed locally, so this run does not claim to reproduce the original timing or prove absence of every product defect. Code inspection establishes the stale expected-value mechanism; QA/Design must retest the immutable repair and inspect the original trace where available.

## Candidate and executed verification

Clean code candidate `f47a20d4eab5fd953217ce0105264951f0b1e183`, incorporating current-main QA #35 and Design #40 without changing their evidence or independent tests. Later receipt commits change documentation only. Owner `codex-engineer-lead-20261005`, branch `engineer/e1-review-blockers-20261005`, claim `refs/heads/engineer/claim-e1` at `1ba940fbce021fd986f512ea6935288eefebd20d`. Environment 2026-10-05 UTC, managed Linux, Node 24.21.0/npm 11.19.0, loopback/no injected network latency, system Chromium 151.0.7922.173. Build fixture seed 42/five seats; browser seed 42/two seats; original all-layout seed vectors retained.

| Check | Result |
|---|---|
| `npm ci`, format/lint/typecheck | Passed on pinned toolchain |
| `npm run test:unit` | 190 passed |
| `npm run test:integration` after upstream refresh | 109 passed, including unchanged independent QA probes |
| Built browser suite with `PACKET_CHROMIUM_EXECUTABLE=/usr/bin/chromium`, Chromium project | 11 passed; full candidate run after restoring diagnostic mutations recorded on PR |
| `npm run build` twice and manifest comparison | Identical manifests on the clean candidate |
| `npm run smoke:artifact` | Passed: canonical health, exact-Origin SDK join, version/origin refusals and configuration failures |
| Documentation, whitespace and three phase-claim checks | Passed |
| Original welcome-before-capture schedule injection | Fails new initial-state control: zero ROOM_STATE frames for final seat instead of one; restored afterward |
| Disable per-sector filtering temporarily | V01 fails: five received ships instead of only own ship; restored afterward |

Schedule injection deliberately restored the old capture boundary and waited for final-seat build state before recording. This deterministically exercises the omitted-initial-frame schedule; it does not pretend to reproduce CI machine timing. The filtering mutation confirms the repaired test still detects disclosure. Neither mutation is committed. Full passing integration ran with the restored production/fixture code; focused V01 is rerun after mutation cleanup.

Local pinned Chromium/Firefox/WebKit installation returned HTTP 403 `Domain forbidden` from cdn.playwright.dev. No local pinned or Firefox/WebKit result is claimed. Required PR CI must supply its own head-specific browser result; prior E1 CI is separate evidence. No deployed topology, public network, capacity or later gameplay acceptance is supplied.

## Next checkpoint

QA #32 independently retests origins, complete initial raw state/patch filtering and the normal browser matrix on this repair. Design #38 reviews the affected held-key/convergence journey and original #39 trace on the same accepted candidate. Engineering repairs are reviewable, but neither team approval nor G1 is supplied here. Maintainer owns merge and gate recording. E2 needs maintainer host/Tunnel/DNS/credential access; dependent gameplay and E5/E6 need the documented accepted inputs, including independent D2/D3 disposition. No release or production action is authorized by this receipt.
