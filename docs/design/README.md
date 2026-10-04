# Design team phases

Status: all phases planned. Use [parallel delivery and shared gates](../DELIVERY_PLAN.md) for scheduling and [QA acceptance IDs](../qa/ACCEPTANCE_MATRIX.md) for traceability. Branches use `design/summary-of-branch`.

## Responsibility and working method

Own the player experience: vision, rules, balance, sector layouts, thin salvage-ship fiction, UI states, and playtest interpretation. The technical baseline remains Canvas 2D shapes and plain DOM; no asset pipeline or UI framework is required. Keep rules in [GAME_DESIGN.md](../GAME_DESIGN.md), scope in [VISION.md](../VISION.md), and handoff decisions in linked issues rather than creating a competing game specification.

**Decision:** approve small behavior contracts ahead of their implementation, with examples QA can independently evaluate. **Why:** Engineering needs stable inputs while Design continues exploring later features. A design phase can hand off an accepted slice before the rest of that phase closes.

Every phase below produces documentation and review evidence. A future playable artifact is an input for validation, not code owned by this planning task. Record a named Design owner and Engineering/QA reviewers for each package. The [handoff record](../DELIVERY_PLAN.md) applies to every slice.

## D0 — Scope and measurable experience

**Outcome:** all teams can explain what October ships and how success is measured.

**Entry:** existing vision and source specifications; no running build needed. Run alongside E0 and Q0.

Small work packages:

1. Confirm the core loop, free-for-all player range, solo bot, keyboard baseline, fiction vocabulary, and explicit non-goals. Review the seven defaults in the docs index and assign unresolved technical defaults to Engineering.
2. Define the join funnel and measurement boundaries. Resolve the ten-second entry claim versus the 15-second Quick Play countdown and 20-second solo goal; distinguish page interaction, lobby entry, and match start.
3. Define player success measures with QA: a first-time player can describe the objective and core/respawn rule after one match; two people on different networks can finish without coaching; a solo visitor starts against a labelled bot within 20 seconds of Quick Play on the agreed test network.

**Deliverables:** updated vision, scope decision record, terminology list, agreed measurement procedures, and initial issue set mapped to A01/A02/A07/A08 in the QA matrix.

**Exit / checkpoint:** every scoped feature has an owner and acceptance ID; no unresolved question blocks the first E1 slice; Engineering and QA accept the measurement boundaries. G0 can close with Q0. Product timing changes must update the vision explicitly.

**Handoff and overlap:** give E1 joining/movement assumptions and Q0 observable goals; begin D1/D2 while tooling proceeds. Technical capacity evidence remains Engineering/QA work.

## D1 — Movement, map, and build economy contracts

**Outcome:** a player can learn move/shoot/build and choose a meaningful use for limited scrap.

The [movement and map contract](../GAME_DESIGN.md#d1-movement-and-map-contract--proposed-revision-1) is a proposed first slice for E1/Q1 review. Economy, build placement, and UI contracts remain separate D1 work.

**Entry:** D0 scope; E0 need not be finished. Split movement/map decisions from the later economy handoff so E1 can start early.

Small work packages:

1. Specify tile movement, facing, held keys/stop, collisions, spawn cells, sector ownership, and out-of-bounds behavior. Draw annotated layouts for 2, 3, 4, and 5 participants, including unowned sectors and two-tile Belt boundaries. Define whether shots can cross the Belt during build.
2. Define seeded deposit placement, counts/payouts, starting scrap, paths from core to deposits, and resource budgets. Check each starting sector has equivalent opportunities under the agreed metric; identify odd-layout advantages to investigate rather than claiming symmetry where it does not exist.
3. Specify harvesting, purchase atomicity, upgrade caps, build-radius distance metric, occupied/blocked tiles, structure overlap, and owner versus enemy wall behavior. Include failed purchases and placement at exactly the radius boundary.
4. Produce lightweight start/lobby/build-HUD wireframes with the timer, hull/core health, shop keys/prices, scrap, build-area highlight, Belt warning, focus states, and visible error feedback. Define which scoreboard fields are public while enemy sectors are hidden.

**Deliverables:** movement/map contract first, then economy/rules tables and annotated UI layouts in or linked from the source specification; Given/When/Then examples for A02–A05. Record starting numbers as tuning hypotheses, not proven balance.

**Exit / checkpoint:** all four layouts have dimensions, spawn/resource/build invariants and boundary examples; every shop action has a success and rejection example; no normal build action exposes an enemy sector; Engineering and QA can derive tests without inventing a rule. Design accepts the implemented build loop at G3 after Q2 evidence.

**Handoff and overlap:** movement/map slice unlocks E1; economy slice unlocks E3 and Q2. Continue D2 while Engineering builds E3. Paper walkthroughs can begin D4 before a complete match exists.

## D2 — Combat and finite match lifecycle

**Outcome:** combat and every ending are fair, explainable, and deterministic.

**Entry:** accepted D1 map/economy contracts. Draft alongside E3; hand off build-phase death/respawn rules before E3 implements that slice, and review technical tick order before E4 implements combat.

Small work packages:

1. Specify beam collision priority, range boundaries, friendly-structure behavior, turret target selection/occlusion/ties, and damage timing. Resolve hull-upgrade healing and simultaneous scrap pickup outcomes.
2. Define a contender across alive, dead-awaiting-respawn, disconnected, and permanently eliminated states. Resolve core destruction during a respawn wait and reconnect expiry. State precisely when a winner or same-tick draw may be declared; a temporarily absent ship must not accidentally end a match.
3. Specify build/battle/sudden-death boundary ticks, lethal Belt behavior, pending respawns when cores shatter, and final results. Prove a finite bound on every map using the approved dimensions and shrink cadence. Reconcile that bound with the vision's five-to-six-minute target.
4. Document combat/death/respawn/results UI states and concise feedback. Record hypotheses for upgrade-assisted harvesting, full wall enclosures, and death-drop snowballing, with experiments and allowed tuning levers.

**Deliverables:** lifecycle transition table, combat examples and boundary cases, duration calculation for each map, results wireframe, and A06/A07 acceptance updates.

**Exit / checkpoint:** QA and Engineering agree on expected outcomes for simultaneous final deaths, no living ships with a respawn pending, core loss during a respawn delay, and disconnect expiry. A paper calculation and expected tick sequence establish the termination bound for each layout. No “decide in code” rule remains in E4's scope. G4 later requires runtime verification too.

**Handoff and overlap:** E4 receives the accepted transition table; Q3 receives exact expected outcomes; D3 and early D4 can proceed while combat is built.

## D3 — Complete multiplayer experience

**Outcome:** players understand joining, disconnection, watching, replay, and server availability.

**Entry:** D0 entry goals and D1 visibility contract. Draft early; final lifecycle language uses D2.

Small work packages:

1. Specify Quick Play and private-room flows: nickname validation, room links, minimum participants, full/locked/stale rooms, host-only start, host departure, host-added bot, and a maximum of one labelled bot. Review any required message-contract addition with Engineering.
2. Define reconnect notices, the 20-second seat window and expiry, fatal disconnect versus temporary loss, eliminated-player watching, results disposal, and Play Again behavior. Reconcile spectator waiting before battle with room lifecycle rules.
3. Define bot behavior priorities and stuck/pathfinding cases using only visible information and legal actions. Define what counts as a playable solo opponent without adding difficulty tiers or more bots.
4. Complete start-page states for Automatic/manual regions, preserved preference on fallback, offline/retry, protocol mismatch, live match lists, and spectator capacity. Add keyboard focus order, focus recovery, readable hazard/status labels, and non-color-only feedback to UI acceptance.

**Deliverables:** annotated end-to-end flow/state inventory, user-facing copy, role permissions, and A08–A11 scenarios. Assets can be text and simple wireframes consistent with the planned renderer.

**Exit / checkpoint:** every journey has happy, unavailable, and recovery paths; reconnect and spectator states agree with server visibility; QA can test each keyboard path; Engineering has a specific contract for host bot insertion and host departure. G5 requires the implemented journeys, not merely these wireframes.

**Handoff and overlap:** accepted lobby/reconnect slices unlock corresponding E5 work before combat finishes. Region UI decisions unlock E6 and Q4 fixtures. D4 runs while the remaining flows are implemented.

## D4 — Playtests and balance iterations

**Outcome:** the documented rules produce understandable choices and a complete match at every player count.

**Entry:** paper walkthrough after D1; build-loop review after E3; full-match sessions after E4/E5 and passing critical Q3 checks. Never use a known game-breaking candidate to evaluate balance.

Small work packages:

1. With QA, write a repeatable playtest script and consent-friendly notes template. Record candidate SHA, config, participant count, seed/layout, experience level, match length, purchases, deaths, and confusion. Do not collect unnecessary personal data.
2. Conduct at least two full matches for each human player count (2, 3, 4, 5), plus three solo/bot runs. Include at least five first-time participants across sessions and two participants on different networks. These are initial formative samples, not statistically conclusive balance proof.
3. Ask first-time participants to describe the goal and core/respawn rule without prompting after their first match. Initial acceptance target: at least four of five explain both accurately; all observed matches terminate within D2's bound; all three solo runs meet the accepted 20-second join target. Record failures and repeat affected checks after changes.
4. Investigate fortify-versus-arm choices, harvesting upgrades, enclosure safety, odd-map advantage, and scrap snowballing. Change one related parameter set per iteration; document hypothesis, observation, choice, and Why. Engineering implements approved tuning and QA reruns affected rule/boundary cases.

**Deliverables:** playtest report with raw summarized observations, balance decisions, prioritized UX defects, revised config/spec proposals, and retest evidence for A01/A03/A07/A08.

**Exit / checkpoint:** the stated sample and experience targets are met, or scope/targets are explicitly revised and retested with all teams; no unresolved critical rule comprehension or dominant-strategy issue blocks launch. A small sample supports iteration, not a claim of perfect balance. Design signs G5 using actual results.

**Handoff and overlap:** send small, reproducible tuning/UX issues to Engineering and QA as sessions finish. Do not bundle a redesign into release hardening; new mechanics return to the relevant contract phase.

## D5 — Design acceptance for release

**Outcome:** the candidate, public instructions, and promised scope agree.

**Entry:** D4 acceptance and an E7/Q6 release candidate. Documentation preparation can start earlier.

Small work packages:

1. Review the exact candidate's start flow, HUD, hazards, bot labelling, private joins, spectator restrictions, reconnect messages, and results against accepted contracts.
2. Reconcile game help, starting values/config references, screenshots if present, and known limitations. Confirm fiction terms and controls are consistent throughout.
3. Record Design acceptance or a concrete blocker against the candidate SHA; route any late behavior change through Engineering and QA impact review.

**Deliverables:** candidate-specific Design sign-off and release-facing feature/limitations summary.

**Exit / checkpoint:** no undocumented behavior deviation remains; D4 evidence applies to this candidate or affected flows are retested; QA and Engineering have the final contract revision. This is one input to G6, not authority to publish a release.
