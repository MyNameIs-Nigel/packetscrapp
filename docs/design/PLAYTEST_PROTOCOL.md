# D4 playtest protocol and notes

Status: preparation only. No playable candidate or playtest result has been recorded. Design owns interpretation, QA verifies acceptance evidence, and Engineering fixes or instruments a candidate. Use this alongside the [D4 phase plan](README.md#d4--playtests-and-balance-iterations), [Vision](../VISION.md), [game rules](../GAME_DESIGN.md), and [acceptance matrix](../qa/ACCEPTANCE_MATRIX.md).

## When to use each session

| Session | Entry | Useful output |
|---|---|---|
| Paper walkthrough | D1 map and economy proposal available | Find rule questions and odd-map risks; no claim about fun, timing, or software quality. |
| Build-loop review | E3 candidate and critical Q2 rule/visibility checks pass | Observe whether harvest and spending choices are understandable; record candidate, seed, and rule defects. |
| Full-match playtest | E4/E5 candidate and critical Q3/Q4 checks pass | Measure comprehension, match duration, solo start, and balance across player counts. |

Do not use a candidate with a known game-breaking defect to evaluate balance. Log the defect and rerun after the fix. A paper walkthrough, fixture, or prototype is preparation, never a substitute for a full-match acceptance run.

## Moderator script

1. Explain that this is a short game study, participation is voluntary, and notes focus on play rather than identity. Ask whether the player is comfortable continuing. Do not record names, contact details, voice, or screen video unless a separate study explicitly needs and approves them. Assign an anonymous session code.
2. Record candidate full SHA, build/config revision, environment/region, hardware, browser, network profile, human count, bot count, map seed, and participant experience (first-time or returning). Note any accessibility setup without collecting a diagnosis.
3. For an uncoached first-time run, say: “Please try a match using what the game shows you. I will not explain the rules while you play. You can stop at any time.” Record where the player hesitates, reads, presses the wrong control, or asks for help. If safety or a broken build requires intervention, record it and mark the uncoached measure invalid.
4. For a solo run, have the player enter a valid nickname before timing. Start the clock at Quick Play activation; record the connected-lobby and first live-build timestamps, region fallback, bot label, and whether a legal move was accepted. QA retains the event trace used to compare client/server times.
5. Observe the complete match. Record phase transition times, purchases, deposits harvested, deaths, respawns, core losses, outcome, duration, and visible confusion. Use events or a tally sheet; do not infer hidden server state from a screenshot.
6. Immediately after the first match, ask without hints: “What were you trying to do, and what happens after your ship and core are destroyed?” Write the answer in the player's words, then score objective and core/respawn understanding separately. Ask one neutral follow-up: “Which purchase felt most useful, and why?” Do not teach before collecting the first answer.
7. Ask whether the player would play again and what blocked or surprised them. Thank them, remove any accidental personal information from notes, and file reproducible defects separately from design observations.

**Decision:** use the same neutral comprehension prompt after the first result for each first-time participant. **Why:** leading instructions would measure the moderator's explanation rather than the game's clarity.

## Coverage and initial acceptance

Run at least two complete matches for each human count 2, 3, 4, and 5, plus three solo matches with one labelled bot. Include at least five first-time participants and at least one completed match involving two people on separate networks. These are formative minima, not a statistically representative balance sample. A session may satisfy several coverage cells, but each full match still needs its own candidate/seed/result record.

| Question | Initial target | Evidence and owner |
|---|---|---|
| Can newcomers explain the goal and core rule? | At least four of five first-time players correctly explain both after their first uncoached match. | Design scores exact answers against the [D0 measure](README.md#d0--scope-and-measurable-experience); QA audits prompt and sample for A01. |
| Can a solo player start? | All three solo runs enter live build against exactly one visible BOT within the agreed 20-second Quick Play measure. | Client/server event times, network profile, and bot/seat trace; QA A08. |
| Do separate networks finish? | Two people on different networks complete the same match without coaching and see the same outcome. | Device/network record and result trace; QA A01. |
| Does every layout finish? | All observed full matches finish within D2's accepted bound for their map. | Start/result ticks and layout seed; QA A07. D2 must set the bound before this can pass. |
| Are choices meaningful? | No unresolved dominant fortify/arm path or critical comprehension defect after review. | Purchases, resource opportunities, deaths, player reasons, and retest notes; Design D4. |

If the sample misses a target, record the exact failure and cause hypothesis. Do not quietly lower the target or drop the run. Any revised target or rule goes through Design, Engineering, and QA impact review, then affected checks rerun. Performance, authority, and hidden-state defects are gate issues even if players did not notice them.

## Paper and balance review prompts

- For each 2/3/4/5-player layout, walk from each spawn to nearby deposits and the internal Belt. Compare reachable starting scrap and travel distance under D1's agreed metric. On odd maps, record which seats reach the unowned sector first and which battle routes are shorter.
- Compare a fortify-first path (wall/turret) and an arm-first path (blaster/hull) with the same seed and available scrap. Note when upgraded blasters also accelerate harvesting, when walls fully enclose a core, and when all-scrap death drops amplify a lead.
- Change one related parameter set per iteration. Record the hypothesis, old/new values, Why, expected player effect, implementation SHA, and QA retest IDs. Never describe a balance proposal as implemented merely because the document changed.

## Copyable session record

```text
Session code / date / moderator:
Consent to note-taking: yes / no (stop if no)
Session type: paper / build-loop / full match
Candidate full SHA / config revision / protocol:
Environment / region / browser / device / network profile:
Human count / bot count / first-time count / map seed / layout:
QA prerequisites and known defects checked:
Quick Play activation / connected lobby / live build timestamps (if solo):
Build start / Belt drop / sudden death / result ticks:
Purchases, harvest, deaths, respawns, core losses (event references):
Outcome shown to every player / match duration:
Uncoached comprehension answer, verbatim / objective correct? / core rule correct?:
Hesitation, wrong inputs, questions, help given, and invalidated measures:
Fortify-versus-arm observation / odd-map observation / player reasons:
Reproducible defects with issue links / separate design observations:
Acceptance IDs, result (pass/fail/blocked), QA evidence links:
Hypothesis, design decision and Why / next owner / retest candidate:
```

Keep raw notes in access-controlled team storage only as long as needed for this study; publish aggregate counts and sanitized quotes in the playtest report. An unconsented or interrupted session is not counted toward a target. No outcome in this template is pre-scored.
