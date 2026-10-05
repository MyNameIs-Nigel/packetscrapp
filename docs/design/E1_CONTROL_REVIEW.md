# E1 Design control review — blocked acceptance

Owner: Codex run `codex-design-controls-20261005`, Design, under [#38](https://github.com/MyNameIs-Nigel/packetscrapp/issues/38). **Partial observation delivered; blanket control acceptance withheld.** Engineering diagnoses [#39](https://github.com/MyNameIs-Nigel/packetscrapp/issues/39), QA retests. This is a Design intent review, not independent QA approval or G1 closure.

Implementation reviewed: `c83da08091bf73cb4733e71ca63fdd7f3db23fb2`, merged E1 #31, protocol 2. Sources: accepted [D1 movement/map revision 1](../GAME_DESIGN.md#d1-movement-and-map-contract--revision-1), #4 / `6221df4354e04ebfde3e903d33480765994f8aa7`, and [D1 UI](D1_UI.md), #6 / `53c2357e39f57303df2c3095df2eafa0fb7fa26a`. A02 primary, A04 build display subset; no combat/economy/reconnect/regions/playtest or release behavior reviewed.

Environment: 2026-10-05 UTC, managed Linux, loopback without added latency, system Chromium 151.0.7922.173, 1280 × 900 CSS-pixel viewport for visual observation. Pinned Node 24.21.0/npm 11.19.0 installed under `/tmp/packet-design-toolchain`; initial default Node 24.19.0/npm 11.9.0 correctly failed `npm ci` with EBADENGINE. No engine requirement was changed. Isolated branch `design/d1-e1-control-review-20261005`, base equal to implementation SHA; claim `refs/heads/design/claim-d1` at `032a71759c7ecce5ae74325b0681caeeec97f5cc`.

## Executed checks and observed experience

With the pinned toolchain selected on PATH, `npm ci --cache /tmp/packet-design-npm-cache` and `npm run build` passed. Then:

```sh
PACKET_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
  node node_modules/@playwright/test/cli.js test --project=chromium
```

**10 passed / 1 failed, 32.2 seconds, no retries.** The seven movement journeys and four waiting-room journeys ran against the built local server/client. All separate focus/blur/document-hidden/disconnect-stop, build-display/Belt, roster, escaped nickname, invalid-name focus and offline/retry cases passed. The two-browser held-key journey failed its final comparison; preceding assertions in that journey completed but the case as a whole did not pass. Existing Engineering tests exercised by a Design reviewer are observation evidence, not a replacement for independently authored QA probes. System Chromium is not the pinned Playwright browser; Firefox/WebKit were not independently run here.

A separate Design browser observation opened two clean contexts, two-seat build fixture seed 42, nicknames Design Alpha/Bravo. The recorded [observation JSON](evidence/E1_OBSERVATION.json) and [screenshot](evidence/E1_BUILD.png) show:

- Initial focus on `board`, own ship `(13,11)` facing right, public two-name roster but only own ship entity displayed.
- Tab reaches `leave-game`; focused movement down changes to `(13,14)` facing down.
- While a direction remains held, focusing Leave stops at `(13,16)` across two observations 400 ms apart, well short of the boundary. Leave returns focus to `nickname`.
- Hatched Belt, distinct hidden-sector pattern/label, triangular facing ship, outlined board focus and DOM phase/position/roster text explain the prototype without relying solely on color. The banner explicitly excludes combat, scrap, respawn and match flow.

Visual review at this viewport found the local prototype legible, with a readable boundary/hazard legend and clear keyboard escape to Leave. These observations support the narrow focus/hazard-display intent; they do not measure contrast, text zoom, assistive technology, real-device/network latency, reduced motion, full-match comprehension or serialization privacy. A screenshot cannot establish server filtering; QA's #36 raw-frame positive control remains unresolved.

## Failure and required retest

`tests/e2e/movement.spec.ts:102` expected Bravo's released ship `(34,9)` as captured from Alpha; polling Bravo instead returned `(34,8)` facing up/alive until the 5000 ms timeout. The assertion samples Alpha immediately after key release and then polls only Bravo against that fixed snapshot. An in-flight patch could make that expected snapshot stale. **Suspected capture race; persistent product divergence is not established.** Do not dismiss the failure because other checks or CI pass. Engineering inspects the original trace/server state and fixes capture or behavior as indicated; QA retains both-client convergence and before-edge stopping assertions and retests the immutable fix.

Original local trace: `/workspace/packetscrapp-controls/test-results/movement-two-browsers-see--7cdd0-ent-and-obey-held-key-rules-chromium/trace.zip`; SHA-256 `094d52e4529ff1e48f3e3326087e2abfc2751eb87740e5aceec2f156efa1b51b`. It remains local, not published with session data. Screenshot SHA-256 `6962a60866360fad059fae1005a16317e48cf4a0e9389bd81c67a7e65c4a9133`. Future reviewers must distinguish the implementation SHA from this documentation/evidence commit.

Copy follow-up for E4/E5: the current global heading says “Last ship wins.” Proposed D2 uses eligible contenders, including a legal pending respawn. Before full gameplay Design review, use the accepted contender explanation and living-core respawn instruction; do not teach that an absent living ship automatically loses. This is deferred integrated-game copy work, not proof the movement-only preview has wrong winner behavior. D3 proposal #33 / PR #37 supplies the full journey language.

## Blockers and Design exit

Engineering owns #39 convergence diagnosis and QA's [#34 preflight defect](https://github.com/MyNameIs-Nigel/packetscrapp/issues/34) / [#36 initial-frame evidence](https://github.com/MyNameIs-Nigel/packetscrapp/issues/36). QA [#32 / draft #35](https://github.com/MyNameIs-Nigel/packetscrapp/pull/35) supplies independent retest. Design reviews affected controls on that fixed SHA before recording G1 acceptance. No product fix, developer-test rewrite or independent QA sign-off was authored here.

D0/D1 contracts are delivered. D2 and D3 complete proposals await Engineering/QA acceptance. D4 protocol and balance experiments already exist; actual sessions require E3/E4/E5 with passing critical Q2/Q3. D5 requires D4 acceptance and E7/Q6 candidate. These are the remaining cross-team inputs; no ready independent Design specification package was found beyond the completed D3 work and this control review.

Documentation/whitespace checks and evidence JSON parsing run for this review package; exact full review head and PR CI are recorded on #38/PR after commit. Required CI on current application remains separate from this failed local Design observation. A successful CI run cannot itself resolve #39 or award Design acceptance. All affected gates stay open.
