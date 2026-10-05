# D3 complete journey handoff

Status: **In review — proposed revision 1, no independent acceptance or runtime evidence.** [#33](https://github.com/MyNameIs-Nigel/packetscrapp/issues/33). Owner: Codex run `codex-design-d3-20261005`, Design. Engineering reviews feasibility/messages/identity; QA reviews oracles; maintainer coordinates named acceptance. User scope is to advance Design until another team's input is required.

## Source and coordination receipt

| Input | Revision and use |
|---|---|
| D0 accepted | #3 / `807e43f15ac64109fc293943117e074867c2ebb3`: solo BOT policy, keyboard scope, 10-second lobby / 20-second solo targets. |
| D1 accepted | #4 / `6221df4354e04ebfde3e903d33480765994f8aa7`: movement/maps/visibility; #6 / `53c2357e39f57303df2c3095df2eafa0fb7fa26a`: UI focus/HUD baseline. |
| D2 proposed | Merged #30 / candidate `7e25052268ab5179489ccc7be8647199046c66fb`, [handoff](D2_HANDOFF.md): lifecycle revision 2, 300-tick grace, boundaries/results. Engineering/QA acceptance still required under #29; merge is not acceptance. |
| Current E1 | Merged #31; base `c83da08091bf73cb4733e71ca63fdd7f3db23fb2`, protocol 2. [Evidence](../engineer/E1_EVIDENCE.md) excludes actual lobby timers/BOT/reconnect/regions. Independent Q1 is actively owned under #32. |
| Isolated delivery | Branch `design/d3-player-journeys-20261005`; worktree `/workspace/packetscrapp-d3`; claim `refs/heads/design/claim-d3` at `55b2d11909dc96190fd70d8c30fc37975ad1159c`. Claim released only after PR/issue handoff. |

Discovery: fetched upstream main without changing the user's `work` checkout; checked all open issue/PR collections (100/page, fewer returned), remote Design claims and phase entries. No active D3 issue/PR/claim existed at acquisition; recheck confirmed the same. GitHub CLI GraphQL was forbidden; connected GitHub tools provided issue/PR access. No authentication changes were made.

## Complete phase coverage and exit

| D3 package | Deliverable / next owner |
|---|---|
| 1 Quick/private journeys | [Lobby](D3_JOURNEYS.md#joining-and-lobby-contract), host departure, solo BOT replacement, explicit message extension in [Architecture](../ARCHITECTURE.md#proposed-d3-session-and-role-contract--revision-1). Engineering E5/QA Q4 review atomic start/admission and idle disposal. |
| 2 Reconnect/watch/replay | [Identity/deadline/replay](D3_JOURNEYS.md#reconnect-departure-and-replay), [roles/cap/filtering](D3_JOURNEYS.md#roles-and-allowed-actions). Engineering/QA accept exact role transitions, credential lifecycle and D2 dependency before implementation. |
| 3 BOT opponent | [Visible-state priorities](D3_JOURNEYS.md#bot-opponent-contract), reachable/stuck/no-resource criteria and deterministic ties. Engineering E5 implements; QA inspects filtered input/actions; D4 later evaluates human experience. |
| 4 Regions/UI | [Availability/link/list](D3_JOURNEYS.md#regions-links-and-live-lists), [wireframes/focus/copy](D3_JOURNEYS.md#keyboard-copy-and-flow-inventory). Engineering E6/QA Q4/Q5 review failures, stale responses and actual browsers/topology. |

[J01–J20](D3_JOURNEYS.md#observable-acceptance-scenarios) map the full proposed contract to A08–A11 primary and A01/A02/A04/A07/A12 boundaries. Every journey has success, unavailable/refusal and recovery paths. No game behavior or test tooling was implemented. No independent approval, playtest or gate closure is supplied.

Changes requiring explicit acceptance: waiting host transfer; private BOT replacement instead of padding two humans; five-minute inactivity disposal; ten external plus five former-player connection budget; unlisted private Watch policy; strictly-before-expiry identity recovery; acknowledged versus undelivered leave; new private replay room/link; bot priorities and region-ID validation. The original ten-spectator wording is refined consistently in the source docs. Engineering pins supported SDK reconnect issuance/rotation, interrupted-ack recovery, wire payload/refusal mapping and protocol compatibility; Design does not invent an implementation token algorithm. Unknown E1 messages remain refused.

- [x] All four D3 proposed contract deliverables, copy, role inventory and observable examples exist.
- [x] No new account/chat/service/framework/gameplay scope introduced.
- [x] D0 solo policy and D1 privacy preserved; D2-dependent rules explicitly remain proposed.
- [ ] Engineering accepts each slice and records supported transport/message/identity design.
- [ ] QA accepts the oracles and schedules independent real SDK/HTTP/browser cases.
- [ ] D2 role/deadline/results contract accepted for dependent E5/E6 lifecycle slices.
- [ ] E5/E6/Q4 and D4 provide runtime journey/playtest evidence for G5.

## Local specification verification

Environment: Linux managed cloud workspace, 2026-10-05 UTC, Python 3.12.14. No seed is needed for documentation/link checks; future BOT fixtures must record bot tie-break seed and visible world. Full documentation candidate SHA and exact PR CI are recorded on #33/PR after commit, avoiding a self-referential SHA in this file.

Passed: `python3 scripts/check_docs.py`, `git diff --check`, and 47 relative Markdown heading-anchor resolutions across every changed document. Historical revision-1 D2 links remain valid through explicit compatibility anchors; historical evidence prose is preserved. Paper walkthrough checks both start/admission race orders, host transfer with 0/1/2 humans, one-human versus two-human BOT policy, all role permissions, disconnect at d with recovery d+299/expiry d+300/denial d+301, eliminated build privacy, 10/11 external watcher admission plus five retained player slots, private replay identity cleanup, and manual A→fallback B→restored A with stale responses. These are the Design author's contract consistency checks, not independently executed QA or runtime passes.

Application code/config/dependencies unchanged. Local application suites not rerun for this documentation-only proposal; required PR CI is checked against the pushed head separately. CI exercises current E1, not D3 runtime behavior. Built keyboard/assistive-technology, contrast, actual bot, TLS/regional and real-network timing evidence remain blocked on E5/E6 and QA candidates.

## Next Design work and blockers

D2 and D3 acceptance require Engineering/QA input. D4 protocol/experiments are already prepared; actual build/full-match sessions need E3/E4/E5 and critical Q2/Q3 qualification. D5 requires D4 acceptance and E7/Q6 release candidate. G1's Design control review can target merged E1 independently of D3 and of current Q1; it is a separate focused package, not a reason to mark this contract Verified. No empty speculative release/preparation package is needed.

After reviewing the proposed D3 revisions, Engineering can implement accepted lobby slices after E1; full reconnect/watcher/replay/BOT integration consumes accepted D2 and implemented E4 where listed in the delivery plan. QA can prepare cases immediately but executes only against real candidates. Maintainer records acceptance owners and pacing/capacity implications. All shared gates remain open.

## Final Design completion review

The [combined receipt](DESIGN_COMPLETION.md#d3--player-journeys-33) records the final consistency pass. D1-compatible bot firing/build poses now require a successful step to acquire facing; no hidden rotate action is implied. J21 specifies early-build result and result-reconnect privacy. D2's transition table now distinguishes forbidden player recovery from D3's permitted former-player watching, and Architecture distinguishes protocol compatibility from build SHA equality. J01–J21 are Design-authored proposed oracles awaiting Engineering/QA review. They supply no runtime journey acceptance.
