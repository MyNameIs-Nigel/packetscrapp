# D2 combat, death, respawn and results UI — revision 1

**Proposed under [#29](https://github.com/MyNameIs-Nigel/packetscrapp/issues/29).** Package 4 of the [full D2 handoff](D2_HANDOFF.md). Rules live in [GAME_DESIGN.md](../GAME_DESIGN.md); this document specifies how those rules are explained. These text wireframes have no browser, contrast, assistive-technology or playtest evidence. Engineering and QA acceptance is pending.

Use plain DOM text for the phase clock, hull/core state, shop, notices and results; Canvas draws the world. Keep the [D1 focus and shop behavior](D1_UI.md#state-and-focus-rules). Controls remain WASD/arrows, Space, 1/2, Q/E. No new gameplay verbs, asset pipeline or color-only signals are needed. Enemy core health and layout remain absent during build; public core-active markers remain allowed. Battle reveal uses the server's phase transition, never a client countdown reaching zero.

## Combat HUD and feedback

```text
BATTLE — SUDDEN DEATH IN 2:38           HULL 60/150
CORE ACTIVE — 210/300                  SCRAP 40

[full board, own ship labelled YOU, other seats named, BOT labelled]
[facing marker; beams briefly drawn from authoritative fire events]

ROSTER: Alex — Core active | Sam — Core destroyed | Salvager — BOT
1 Wall 10 | 2 Turret 40 | Q Blaster 100 | E Hull 80 | Space Fire
Move WASD/arrows                     [ Leave match ]
```

Keep the ship/facing indicator visible, with a shape/text distinction for self and BOT. A turret's square range indicator must correspond to the inclusive Chebyshev rule; do not suggest it shoots through blocked cells. Beams are feedback for server-accepted shots, including misses, with no implied travel time or second collision. A wall hit and a ship hit are visually distinguishable by shape/label, without introducing a noisy live announcement for every shot. DOM hull values and event notices carry the readable damage result.

| Authoritative state/event | Visible copy and allowed controls |
|---|---|
| Battle begins | `BELT DOWN — enemy sectors revealed.` Switch phase heading and map together when the full authorized view arrives. If loading the view, show `Revealing map…` and suppress actions until ready. |
| Core destroyed, ship living | `CORE DESTROYED — your next ship loss is final.` Core label becomes `Destroyed`; ship controls remain enabled. No respawn countdown appears. |
| Ship destroyed, core living | `SHIP LOST — respawn in 0:15.` Show actual remaining server ticks, rounded up to whole seconds. Disable fire, movement, build and upgrades while awaiting respawn; Leave remains reachable. |
| Spawn deadline reached but tile blocked | `Respawn ready — spawn tile occupied.` Keep the seat in the roster as awaiting respawn; show no invented reset timer. Controls remain disabled until an actual spawn arrives. |
| Core destroyed during respawn wait | `CORE DESTROYED — you are eliminated.` Remove the timer immediately; never promise another spawn. |
| Respawn arrives | `SHIP REBUILT — hull restored.` Show current maximum hull and persistent upgrade levels from server state. Require fresh keys: held input from before death cannot restart movement or fire. |
| Sudden death | `SUDDEN DEATH — all cores destroyed. Belt closes every 2 seconds.` Label hazard cells `LETHAL BELT` with pattern as well as color; show `NEXT RING 0:02` from server deadline. Construction shows `Core required`; legal living-ship upgrades remain available. |
| Permanently eliminated | `ELIMINATED — you cannot respawn.` Reject gameplay locally and at the server. If watcher admission succeeds, show `Watching this match`; otherwise show the actual watcher-capacity notice supplied by D3. |
| Build Belt death | `SHIP LOST — the Belt is lethal. Respawn in 0:15.` Keep only the authorized own-sector view; death never unlocks enemy/unowned build data. |
| Abandoned/expired seat | `Your seat has expired. You cannot return as a player.` No gameplay controls or implied resurrection; offer return to start. D3 supplies reconnect transport notices. |

Core loss, ship loss and elimination notices last at least three seconds or until the next relevant state replaces them. Use a polite status region for phase and routine feedback; announce a core's destruction, elimination and ending once when the state changes. Do not announce every tick or repeat unchanged countdown values. If multiple transitions occur on one tick, show the final role: a death followed by sudden-death core shatter produces elimination, without flashing a false 15-second respawn promise.

**Decision:** distinguish `Core destroyed` from `Eliminated` while a ship lives. **Why:** D2 lets that ship continue fighting and winning; the interface must teach that core loss ends future respawns rather than the current ship.

## Results and expiry

```text
MATCH OVER — ALEX WINS
Alex was the last contender.                  [ Play Again ]
Your result: Eliminated                       [ Return to start ]
Room closes in 0:15
```

Alternate result copy: `DRAW — Alex and Sam were eliminated together.` List exactly the server's draw set, excluding previously eliminated seats. If the winning seat has a pending respawn, say `Alex wins — last contender, awaiting respawn.` Never imply a living ship was required. Keep BOT labels next to any bot result name. Do not invent score, damage, rank, rewards or saved progression.

The room closes 15 seconds after the authoritative result; display rounded-up remaining seconds. Play Again leaves the ended room and hands nickname/region to D3's new-room journey; it never resets this room or reuses its reconnect identity. A slow client receives the server's remaining time, not a new 15-second window. If disposal arrives first, preserve the already-received result locally and replace the timer with `This match has closed.` When no result was received, show `This match has closed. Return to start.` rather than guessing a winner. D3 owns whether a private replay creates a new room/link.

## Keyboard and focus paths

| Transition | Focus behavior |
|---|---|
| Build → battle → sudden death while game surface focused | Keep focus on game surface; phase text changes without stealing keyboard control. |
| Ship loss / core loss | Keep current focus; disable illegal gameplay. Tab still reaches Leave. Respawn restores controls only when focus is already on the game surface; never steal focus from a button/dialog. |
| Player tabs away or opens Leave confirmation | Clear movement/fire intent and release held-key state. Typing or Space on a button cannot send gameplay. Resume only after return to the visibly focused game surface and a new key press. |
| Leave match | Show `Leave this match? Your seat will be eliminated.` Default focus to Cancel; Tab reaches Leave; Escape cancels and restores the invoking control. Confirmed Leave uses the server departure transition before return to start. |
| Match ends | Clear inputs, focus the results heading once (programmatically focusable), then Tab → Play Again → Return to start. Space/Enter on these buttons never fires a shot. |
| Results expire while a control is focused | Retain the local result/actions and focus; announce closure once. D3 supplies the focus target after returning to start or joining another lobby. |

Keyboard paths are finite and must work without pointer input. Visible focus indicators, text reflow on a typical laptop viewport, readable hazard patterns, text contrast, nickname escaping and status announcements require built-client QA evidence later. These wireframes do not establish that those checks pass.

## Observable UI acceptance examples

| Case | IDs | Given / When / Then |
|---|---|---|
| UI01 | A02/A06 | Given a living ship loses its core, when the event arrives, then the notice says next death is final and movement/fire still work. |
| UI02 | A06 | Given a core-backed death at tick 100, when timer stage 324 completes, then the UI still awaits respawn; at 325 it enables fresh-key input only if a spawn actually arrived. An occupied tile shows a waiting reason. |
| UI03 | A04/A06 | Given a build Belt death, when the respawn notice appears, then no enemy/unowned entities or health are present in received state or display. |
| UI04 | A06/A07 | Given a due respawn and sudden-death core shatter on 4500, when the final state arrives, then only elimination appears, without a respawn promise. |
| UI05 | A02/A07 | Given the player presses Tab, confirms Leave or activates Play Again, when focus leaves the surface, then no movement/fire leaks from held keys or Space. Escape in Leave cancels predictably. |
| UI06 | A06/A07 | Given two final permanent deaths, when results appear, then the draw names exactly those contenders; two live-core deaths instead show respawn waits and no results. |
| UI07 | A07 | Given a sole pending-respawn contender wins, when results render, then the same winner is shown to every client and the explanation states awaiting respawn. |
| UI08 | A07 | Given a result received ten seconds after ending, when displayed, then about five seconds remain. Expiry preserves the known outcome and actions without moving focus; a client without a result invents none. |

Engineering implements these alongside E3/E4. QA Q2/Q3 executes received-state, rule and browser examples against one candidate; Design reviews readability and intended feedback before G4. D3/Q4 complete watcher/reconnect/replay journeys.

## Balance hypotheses and experiments

Run only on a playable candidate qualified by critical Q2/Q3 cases, using the [D4 protocol](PLAYTEST_PROTOCOL.md). Every observation records full SHA, config revision, seed, seat/participant count, purchases, deaths and duration. Paper expectations are hypotheses, never measured results. A proposed change returns to Engineering/QA for affected conservation, collision, timer, UI and bound checks.

| Hypothesis | Paired experiment and observations | Allowed tuning levers / decision trigger |
|---|---|---|
| Blaster upgrades make harvesting dominate fortification | Same seed/seat, alternate upgrade-first and fortify-first routes; record first purchase time, scrap spent/earned, build output and battle outcome. Repeat at each player count with seat swaps. | Blaster damage/cost or fixed deposit-only damage. Investigate when upgrade-first repeatedly offers both stronger fighting and better resources without an observable tradeoff; D4 decides from actual observations. |
| Full wall enclosures stall active battles | Same seed with an enclosed core and an accessible core; record entry time, shots/scrap spent and whether only sudden death ends the defense. Check owned-wall protection and fire occlusion independently. | Wall health/cost and build radius. Preserve owner pass-through and finite hazard termination unless a separately reviewed rule revision changes them. |
| Full scrap drops let the first kill snowball | Track pre/post-kill scrap, who recovers each drop, upgrades and subsequent deaths; compare even starts and small leads with seat swaps. | Drop fraction, if D4 evidence justifies it; conservation tests must cover retained/removed/dropped fractions. No informal duplicate or free refill. |
| Odd-layout seats have unequal post-Belt opportunity | Across 3/5-player maps, swap participants through fixed seeded slots; record routes to unowned deposits, contested scrap, first contact and winners. | Spawn offsets/resource placement or budget, all subject to D1 invariants and a reviewed revision. Do not label the maps symmetric from budgets alone. |
| Two-second rings end fairly while allowing reactions | Record escape decisions, missed hazard cues, ending ticks and real match durations across all layouts, including no-action, blocked-spawn and enclosure fixtures. | Ring cadence/initial timing; every proposal recalculates every layout's upper bound and the six-minute target before approval. |

No balance result or dominant strategy is asserted by this contract. D4 owns experiments and acceptance; D2 supplies the levers and expected invariants.
