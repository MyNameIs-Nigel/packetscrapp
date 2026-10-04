# D0 scope and entry record

Status: Design proposal, revision 1. Engineering and QA review is pending; no runtime measure has passed. This record explains the [Vision](../VISION.md) and [game rules](../GAME_DESIGN.md) rather than replacing them. It supplies the first work packages for [G0](../DELIVERY_PLAN.md) and acceptance IDs [A01, A02, A07, A08](../qa/ACCEPTANCE_MATRIX.md).

## Scope decisions

| Decision | Why | Source and next owner |
|---|---|---|
| October's match is a 2–5-participant free-for-all. One human may start only when exactly one visibly labelled bot fills the second seat. A bot never fills a lobby that already has two humans. | A two-person match must be fun without disguising automation or padding larger lobbies. | [Vision](../VISION.md), [game rules](../GAME_DESIGN.md); Design reviews behavior, Engineering implements E5, QA checks A02/A08. |
| Move, shoot, and build are the three player verbs. A keyboard controls a tile-grid ship; harvesting uses shooting. The start page and HUD must expose the objective, core/respawn rule, controls, timer, and prices without requiring a tutorial paragraph. | One learned action carries into battle, and the outcome should be understandable in one match. | [Game rules](../GAME_DESIGN.md); Design D1/D3 UI, QA A01/A02/A05. |
| The fiction names are salvage ship, scrap, core, sector, and Belt. A core rebuilds its ship while alive; the Belt separates claims during build. | A small, consistent vocabulary can explain the mechanics in short labels. | [Vision](../VISION.md); Design D3/D5 copy review. |
| Accounts, persistence, progression, teams, chat, touch controls, sound, and live match migration remain outside October scope. | They add services or interaction paths without helping the required two-person, understandable, reachable match. | [Vision](../VISION.md); maintainer approves any scope change. |
| The ten-second entry target ends at a connected Quick Play lobby, not the start of a match. The 15-second countdown remains; solo build start has its own 20-second target. | A 15-second solo countdown and a ten-second solo match start cannot both be true. The revised wording makes each promise observable. | [Vision](../VISION.md); Engineering/QA review the timing budget before E1/E5. |

These decisions confirm the D0 scope for review. They do not claim that the 20-second solo target is feasible on production networks or that the match-duration target is proven. D2 must calculate the latter for each layout.

## Vocabulary and player-facing meanings

| Term | Meaning in UI and playtest prompts |
|---|---|
| Ship | The player's controlled unit. Losing it starts a respawn wait if its core can rebuild it. |
| Core | The player's base target. Once destroyed, it cannot rebuild another ship. |
| Scrap | The single currency for walls, turrets, and ship upgrades. |
| Sector | A starting claim with one player's core; unowned sectors contain no core. |
| Belt | The lethal, two-tile sector boundary during build; it disappears at battle and returns from the outside in sudden death. |
| Lobby | A connected room before the match starts. A participant may wait here; this is not the build phase. |
| Build phase | Match time begins; the player can move, harvest, and spend while sectors are isolated. |
| Battle | The Belt has dropped and sectors can be crossed. |
| Bot | A labelled, server-controlled participant using legal player actions. |

Use **Quick Play**, **Private room**, **Play Again**, **WALLS DROP**, and **BOT** consistently in the interface. The D3 copy pass will settle exact longer messages and focus behavior. Avoid describing the lobby as live gameplay in success metrics.

## Entry funnel and measurement

These are product targets, not automatic passes. Record the full candidate SHA, region, client/server protocol, browser/device, network profile, clock source, run count, and each observed duration. A scripted timing run begins with an already-entered valid nickname so human typing does not dominate it; a separate uncoached journey checks whether first-time players can find the field and button. Use monotonic client timestamps for page/button events and server timestamps or synchronized trace events for room transitions. QA and Engineering must agree how to correlate the clocks before quoting a result.

| Milestone | Start | Stop | Target / interpretation |
|---|---|---|---|
| Start page usable | Top-level navigation begins | Nickname, Quick Play, and service status are usable by keyboard | Record separately; no ten-second claim is attached to page loading. |
| Quick Play lobby entry | Valid nickname and region choice are ready; player activates Quick Play | Server has admitted the seat and the client displays the connected lobby, player identity, and countdown | At most 10 seconds on the agreed test network. Health recheck and fallback are included. An error page or disconnected shell is not a lobby. |
| Quick Play countdown | First participant is admitted to an empty lobby | Server starts the build phase, normally at its 15-second deadline or immediately at five seats | The 15 seconds are a room rule, not a UI latency allowance. Later arrivals inherit the existing deadline. |
| Solo match start | A lone human activates Quick Play with a valid nickname | Client displays the live build phase with a second participant labelled BOT and accepts a legal move | At most 20 seconds on the agreed test network; includes region selection, lobby admission, countdown, bot insertion, and first playable state. No existing human may silently be replaced. |
| Complete match | Server starts build | Results identify a winner or a draw and offer Play Again | Record duration. D2 must define a finite upper bound for each map before any five-to-six-minute claim is accepted. |

**Decision:** measure the solo target from button activation, not from lobby admission. **Why:** it captures the wait the player experiences, including a region check. With a 15-second countdown, region selection, join, bot insertion, and first state together have roughly five seconds of budget. If that cannot be met reliably, Design, Engineering, and QA must revise the target or rule together before G5; hiding network time would not resolve the conflict.

## Initial observable examples

1. **A01/A08 solo:** Given a valid nickname, an available region, and no other humans in an open lobby, when the player activates Quick Play, then a connected lobby appears within ten seconds; the server starts build with exactly one human and one visibly labelled bot within 20 seconds. Record both durations from the same button event.
2. **A02 human arrival:** Given one human waiting in Quick Play, when another human joins before the room deadline, then both occupy seats and no bot is added at that deadline. A five-seat lobby starts immediately and rejects a sixth player as a player.
3. **A01 unaided pair:** Given two first-time participants on separate devices and networks, when each receives only the public interface, then they can join and finish a match without coaching. Record any prompts, failed joins, and whether both saw the same result.
4. **A01 comprehension:** Given at least five first-time participants, when each completes their first match, ask the neutral prompt, “What were you trying to do, and what happens after your ship and core are destroyed?” At least four of five must correctly describe the objective and that a living core permits respawn while a destroyed core makes the next ship loss final. Record answers before explaining the rules.
5. **A07 end state:** Given a finished match, when results appear, then the outcome and Play Again action are readable. D2 must supply exact win/draw timing before this case can be fully verified.

The D4 [playtest plan](README.md#d4--playtests-and-balance-iterations) owns the participant sample and records confusion separately from software defects. QA owns independent measurement and may mark a case blocked if a build, network, or trace is missing.

## Initial work packages and handoffs

These are issue-ready records. Create or link repository issues when the three teams assign people; a role label here is not a named reviewer or an accepted contract. Each issue should use the [handoff template](../DELIVERY_PLAN.md#work-package--handoff-record).

| Package | Accountable role and required reviewers | Prerequisite | Acceptance / deliverable | Next checkpoint |
|---|---|---|---|---|
| D0.1 scope and entry wording | Design lead; Engineering and QA review | None | This revision, Vision wording, A01/A02/A08 timing examples | Review timing budget and approve or revise G0 contract. |
| D1.1 movement/map contract | Design lead; Engineering and QA review | D0 scope accepted | All four layouts, spawn/collision/Belt/facing examples for A02–A04 | Give E1 an accepted revision before implementation. |
| D1.2 economy contract | Design lead; Engineering and QA review | D1 map contract | Seeded resources, legal purchases, radius and rejection cases for A03/A05 | Give E3 and Q2 an accepted revision. |
| D2.1 lifecycle contract | Design lead; Engineering and QA review | D1 map/economy accepted | Tick order, respawn/contender table, finite duration proof for A06/A07 | Give E4/Q3 exact expected outcomes. |
| D3.1 lobby and bot journey | Design lead; Engineering and QA review | D0 entry target; D1 visibility for full flow | Host, bot, reconnect, watcher and fallback states for A08–A11 | Approve E5/E6 message and UI contract. |

## Open decisions with owners

The seven defaults in the [documentation index](../README.md#open-decisions) remain proposals. D0 does not turn them into accepted rules.

| Index default | Owner and next checkpoint |
|---|---|
| Full server is unavailable for automatic selection | Engineering E2/E6 and QA Q5; Design D3 reviews the player notice. |
| Atlanta accepts traffic through Cloudflare Tunnel | Engineering and maintainer E2; QA Q5 validates actual access. |
| Atlanta pulls an environment-approved artifact | Engineering and maintainer E2; QA Q5 validates approval and rollback. |
| New York retains SSH push | Engineering and maintainer E2; QA Q5 validates release/restore. |
| Deposits are harvested by shooting | Design D1; Engineering/QA review resource and collision examples. |
| Sudden death shatters cores and closes the Belt | Design D2; Engineering/QA review tick boundaries and bound. |
| All unspent scrap drops on death | Design D2/D4; QA records any snowballing in playtests. |

Further D1–D3 ambiguities remain assigned in the [delivery decision register](../DELIVERY_PLAN.md#decisions-to-close-before-implementation). G0 stays open until named Engineering and QA reviewers accept these first-slice examples and Q0 maps them to cases.
