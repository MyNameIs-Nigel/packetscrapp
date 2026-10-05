# Game design

Design specification; gameplay is not implemented yet. Rule changes should include deterministic tests and a compatibility review under [ENGINEERING.md](ENGINEERING.md).

The [Design phase plan](design/README.md) schedules rule, map, balance, and UI decisions. The [shared decision register](DELIVERY_PLAN.md) identifies unresolved edge cases and their owners; Engineering must use accepted contracts and QA checks them through the [acceptance matrix](qa/ACCEPTANCE_MATRIX.md). Starting values below remain hypotheses until validated.

## Summary

Packet Scrapp is a free-for-all for 2 to 5 ships on a tile grid. Each player has a ship and a core. Destroyed ships respawn beside their core until the core is destroyed. The last eligible contender wins; a ship awaiting a legal respawn still counts. The proposed [D2 lifecycle contract](#d2-contender-and-win-draw-contract--revision-2) makes this precise.

## Match flow

| Phase | Clock | What happens |
|---|---|---|
| Lobby | Up to 15 s | Players gather. A bot joins if only one human is present. |
| Build | 0:00 to 2:00 | The Belt is up. Players harvest, build, and upgrade inside their own sector. |
| Battle | 2:00 to 5:00 | The Belt is gone. Players attack each other's ships and cores. |
| Sudden death | 5:00 onward | All cores shatter and the Belt closes in from the map edge. |
| Results | After the last kill | The winner is shown, with a Play Again button. |

**Why 2 minutes of building:** the original Walls format gives 15 minutes, which is too long for a game joined from a link. Two minutes is long enough to make a few real spending decisions and short enough that a new player is fighting before they lose interest.

**Why sudden death:** two cautious players behind walls could otherwise stall forever. A match that cannot end is a broken rule, so the clock forces an ending.

## The map

The map is a grid of square sectors. Each player owns one sector, with their core at its center.

| Players | Sector layout | Unowned sectors |
|---|---|---|
| 2 | 2 × 1 | 0 |
| 3 | 2 × 2 | 1 |
| 4 | 2 × 2 | 0 |
| 5 | 3 × 2 | 1 |

- Players are assigned to sectors at random.
- An unowned sector has no core and holds extra scrap deposits.
- The layout is fixed when the match starts and does not change if someone leaves.

**Why sectors:** square sectors tile cleanly on a grid at every player count, so map size scales with players and nobody starts with more room than anyone else.

**Why unowned sectors are rich:** they give players a reason to leave their base after the Belt drops, and they stop an odd player count from leaving dead space on the map.

### D1 movement and map contract — revision 1

This is the Design rule contract for E1 and Q1; it does not claim implemented or verified behavior. Coordinates are zero-based `(x, y)`, with `(0, 0)` at the top-left and `y` increasing downward. A sector occupies exactly 24 × 24 cells. The room records one server-chosen seed before assigning sector seats. The same player count and seed reproduce the unowned slot and sector-slot ordering; reproducing which participant receives each slot also requires the participant join order. The economy contract separately defines deposits and their seed use.

These diagrams show one canonical seat arrangement. `A`–`E` are player sectors, `U` is an unowned sector, `||` and `==` are the two-tile lethal Belt between sectors during build. Labels are examples, not fixed player identities.

```text
2 players, 48 × 24:       [ A ] || [ B ]

3 players, 48 × 48:       [ A ] || [ B ]
                           ==     ==
                          [ C ] || [ U ]

4 players, 48 × 48:       [ A ] || [ B ]
                           ==     ==
                          [ C ] || [ D ]

5 players, 72 × 48:       [ A ] || [ U ] || [ B ]
                           ==     ==     ==
                          [ C ] || [ D ] || [ E ]
```

| Players | World cells | Unowned-slot selection | Internal Belt cells during build |
|---|---|---|---|
| 2 | 48 × 24 | None | `x = 23, 24` |
| 3 | 48 × 48 | Seed selects one of four sector slots | `x = 23, 24` and `y = 23, 24` |
| 4 | 48 × 48 | None | `x = 23, 24` and `y = 23, 24` |
| 5 | 72 × 48 | Seed selects either center-column slot | `x = 23, 24, 47, 48` and `y = 23, 24` |

The intersection of horizontal and vertical bands is Belt too. The outer map edge has no build-phase Belt; a move beyond it is rejected. Every sector owns its full 24 × 24 coordinate block, including its half of each adjacent Belt. The Belt is a hazard, not a second claim or a free lane. The client may show the map shape and sector boundaries during build, but must not receive or draw another sector's deposits, structures, ships, pickups, or core health; unowned-sector entities are hidden too. Public roster data may include nickname, bot label, and core-alive marker; detailed enemy state waits until battle. Engineering and QA verify the exact serialized-state split against [A04](qa/ACCEPTANCE_MATRIX.md).

**Decision:** a shared boundary is two cells total, one from each neighboring sector. **Why:** all four layouts then have the same crossing hazard and a sector never loses more buildable width merely because it has a neighbor on one side.

The core is a single impassable tile near the sector center. For a left-column sector its local `x` is 12; for a right-column sector it is 11; a center-column sector uses 11. A top-row sector uses local `y = 12`, a bottom-row sector uses 11, and the single-row map uses 11. For example, the two-player cores are at world `(12, 11)` and `(35, 11)`. The initial ship spawn is the neighboring tile toward the map center: right of a left-column core, left of a right-column core, below a top-row center-column core, or above a bottom-row center-column core. This tile and the core tile are clear of deposits and cannot be built on. The ship initially faces from its core toward that spawn tile.

**Decision:** mirror core and spawn offsets at opposite edges. **Why:** each paired outer sector starts the same distance from its nearest internal Belt. The three- and five-player maps still have unequal battle routes; D4 must test those advantages rather than call the layouts symmetric.

Movement uses four cardinal directions. The client maps WASD and arrow keys to the same directions and sends `move` with the most recently pressed direction that remains held; releasing the last held direction sends `none` immediately. If two key events have the same timestamp, their observed event order decides. There is no diagonal move. The server stores only the latest valid direction enum value or `none`, clears it on death or disconnect, and attempts at most one tile move on even-numbered match ticks (2, 4, 6, ...) after build starts. Other ticks do not move a ship. A valid direction persists until changed or stopped; a rejected attempted step does not erase the held intent.

All movement intents on a tick use positions at the start of that tick. A ship cannot enter a tile occupied by another ship at that point, even if the occupant also intends to leave; swaps and two ships aiming at one tile both fail. A core, deposit, turret, and enemy wall block entry. An owned wall is passable to its owner. A scrap pickup is passable and is collected under the tick-order rule. A ship may step into a Belt cell during build; that step succeeds and the Belt kills the ship in the damage/death stage of the same tick. A step beyond the world is rejected, leaving position and facing unchanged. Facing changes only after a successful step, including a lethal Belt step; holding fire while stopped uses the last successful facing.

**Decision:** shots fired during build stop at the first Belt cell and cannot hit a neighboring sector. **Why:** the lethal crossing hazard must not let a player raid an unseen base from safety. Full beam collision priority is in the [D2 combat contract](#d2-combat-collision-and-targeting-contract--revision-2); this boundary rule remains enough for E1 visibility and E3 harvest preparation.

Observable examples for A02–A04:

1. Given the left ship on `(22, 11)` in a two-player build, when it moves right on a movement tick, then it enters Belt cell `(23, 11)` and dies that tick. No ship reaches `(24, 11)` before battle.
2. Given a ship at `(0, 8)` facing left, when it holds left, then position and facing remain unchanged; when it subsequently moves down to `(0, 9)`, facing becomes down.
3. Given adjacent ships trying to swap tiles on the same tick, then neither moves. Given two ships targeting the same empty tile, neither moves.
4. Given a player firing east at a deposit in their own sector with the Belt behind it, then the deposit may take a legal hit; a target beyond the first Belt cell takes none.
5. Given fixed seeds, participant join order, and each player count, then the advertised world size, sector assignment, reserved core/spawn cells, and Belt coordinates match the table. A new build-phase client's received state contains no enemy or unowned-sector entities. At battle reveal, the Belt disappears and the full map becomes visible.

## The Belt

During the build phase, bands of asteroids two tiles thick run along every sector border. A ship that enters a Belt tile is destroyed at once.

- The owner respawns on the reserved tile beside their core after the normal respawn delay.
- Any scrap the ship was holding drops inside the Belt and cannot be reached until the Belt is gone.
- At 2:00 the Belt disappears everywhere.

**Why lethal instead of solid:** an invisible wall teaches nothing. A hazard that kills you teaches the rule in one try, costs 15 seconds of a 120-second build phase, and makes crossing early a risk a player chooses to take.

**Why instant death:** if the Belt dealt damage over time, a hull upgrade would let a ship survive the crossing and raid a base early. Instant death keeps the build phase safe for everyone.

## Controls

| Input | Action |
|---|---|
| WASD or arrow keys | Move one tile at a time. Hold to keep moving. The ship faces the way it last moved. |
| Space | Fire the blaster in the facing direction |
| 1 | Build a wall on the tile in front of the ship |
| 2 | Build a turret on the tile in front of the ship |
| Q | Upgrade the blaster |
| E | Upgrade the hull |

The key hints stay on screen for the first few seconds of each match and remain visible on the shop bar.

**Why three verbs:** move, shoot, and build are all a player has to learn. Harvesting uses the shoot verb, so the build phase teaches the same button the battle uses.

**Why grid movement:** every position is a whole tile, so the server and every client always agree on where things are. This removes the need for client-side prediction and lag compensation, which is the most expensive part of real-time netcode.

## Scrap

Scrap is the only resource.

- Deposits are scattered through every sector. Shooting a deposit wears it down, and destroying it pays its scrap to the player who landed the last shot.
- Small deposits break quickly and pay a little. Large ones take longer and pay more.
- Deposits do not come back.
- Scrap goes straight into the player's total. There is nothing to carry home.

**Why one resource:** the central decision is fortify or arm. A second resource would add bookkeeping without adding a decision.

**Why deposits do not regrow:** a finite supply makes every purchase a real tradeoff, and it pushes players out of their sector once it is mined out.

### D1 deposit budget and generation — revision 1

This Design rule contract uses the accepted [D1 movement/map contract](https://github.com/MyNameIs-Nigel/packetscrapp/pull/4), including its 24 × 24 sectors and mirrored core coordinates. It does not claim an implemented generator or a measured balance result. Engineering chooses and pins a deterministic random algorithm; a recorded player count, map seed, and config revision must reproduce the same deposit cells and types. QA must inspect the generated state, not infer fairness from a drawing.

| Sector | Small deposits | Large deposits | Maximum scrap created by deposits |
|---|---:|---:|---:|
| Each owned sector | 8 × 10 scrap | 2 × 40 scrap | 160 |
| One unowned sector, when present | 12 × 10 scrap | 4 × 40 scrap | 280 |

The room starts every participant at **0 scrap**. No deposit respawns. The maximum deposit-created scrap is 320, 760, 640, or 1,080 for 2, 3, 4, or 5 participants respectively. These amounts exclude scrap transferred through death drops or pickups; transferring scrap must never create a second copy. Spending removes scrap from the match. All values are tuning hypotheses for D4.

Generate one canonical owned-sector template per room seed, then mirror it horizontally and/or vertically to match each sector's proposed core offset. Every owned sector receives the same number, types, payouts, and multiset of Manhattan distances from its core. Use these candidate bands in the canonical 24 × 24 sector: two small deposits at core distance 3–4, four at 5–7, two at 8–10; one large at 5–7 and one at 8–10. Each deposit occupies a unique cell inside local `x,y = 2..21`, outside any Belt cell, core cell, reserved spawn cell, or other structure. Reserve all four cells adjacent to the core while generating so every sector's selected spawn remains clear. At least one small deposit must be reachable from the spawn within four cardinal steps to a legal firing tile. Every deposit must be reachable from that sector's spawn by a cardinal path to a legal firing tile, treating deposits and the core as obstacles and the build-phase Belt as lethal. A legal firing tile has an unobstructed cardinal blaster line to the deposit within the current eight-tile range. If a candidate template fails an invariant, generate another from the seeded stream; Engineering must bound retries and supply a verified fallback template.

Unowned sectors use the same seed stream after the owned template. Their deposits occupy unique non-Belt interior cells. For every deposit, a cardinal path must run from a traversable entry cell shared with an adjacent sector after the Belt drops to a legal firing tile; an outer map edge does not count as an entry. The four-player map has no unowned budget. The three- and five-player layouts offer extra contested scrap after battle, but travel distance and encounter exposure are unequal; D4 records seat advantage rather than calling the maps symmetric.

**Decision:** use equal mirrored starting budgets and a richer unowned sector. **Why:** each ship can earn the same amount without crossing the build-phase Belt, while an odd-player map gains a contested post-Belt objective. Equal resource opportunity does not prove equal battle position.

## The shop

| Item | Type | Effect | Cost |
|---|---|---|---|
| Wall | Fortify | Blocks enemy ships and enemy shots. The owner passes through it freely. | 10 |
| Turret | Fortify | Fires automatically at enemy ships in range | 40 |
| Blaster upgrade | Arm | More damage per shot, 3 levels | 50, 100, 150 |
| Hull upgrade | Arm | More ship health, 3 levels | 40, 80, 120 |

Building rules:

- Structures can only be placed within 8 tiles of the player's own core. The buildable area is highlighted.
- Structures can be built in both the build and battle phases.
- Upgrades apply at once and survive respawns.

### D1 purchase and placement contract — revision 1

These rules are the Engineering/QA contract with the deposit budget above. They clarify the shop table; costs, health, damage, and level limits remain starting values until playtests.

- A purchase uses the ship's facing and position at the **start of the tick**, before that tick's movement. Keys `1` and `2` target exactly the cell immediately in front of the ship. `Q` and `E` affect that player's ship, wherever it is. The ship must be alive. The server is the only authority for price, position, ownership, level, and scrap.
- The build radius is **Manhattan distance** `|x - coreX| + |y - coreY| ≤ 8`, inclusive. The target must lie inside the player's own sector and off the Belt. The core and reserved spawn tile are never buildable. A target occupied by any core, deposit, wall, turret, ship, or scrap pickup is rejected. No structure replaces another. A living core is required to build a wall or turret; building is allowed in build and battle, but not sudden death or results.
- Upgrade costs are the listed next-level price: blaster 50/100/150 and hull 40/80/120 for levels 1/2/3. Level 3 is the cap. Upgrades are allowed while alive in build, battle, and sudden death and survive a respawn. Hull-upgrade healing is specified in the [D2 combat contract](#d2-combat-collision-and-targeting-contract--revision-2): max hull rises by the level bonus and current hull rises by the same amount, capped at the new max.
- The server applies at most one valid build and one valid upgrade request per player per tick, in that order, against the current scrap balance. For each kind, the earliest valid request received before the tick is the candidate; later requests of that kind are ignored. A successful request creates exactly one item or level and deducts its cost once. An invalid or unaffordable request changes neither balance nor world. Scrap earned by fire or pickup later in a tick becomes spendable on the next tick. Concurrent client input does not permit two purchases with the same funds.
- An owned wall is passable by its owner's ship and beam; an enemy ship cannot pass it, and an enemy beam hits and damages it before anything behind it. A turret blocks movement for every ship. Beam pass-through, turret targeting, occlusion, and seat ties are specified in the [D2 combat contract](#d2-combat-collision-and-targeting-contract--revision-2).
- Destroying a small or large deposit awards its 10 or 40 scrap **once** to the player credited with the final hit; partial damage pays nothing. The deposit disappears and does not regrow. Simultaneous final hits and pickup merges follow the D2 combat damage-stage order.

**Decision:** treat failed purchases as no-ops with a visible reason. **Why:** a player should never lose scrap when placement, range, occupancy, or a cap prevents the intended item, and QA can verify conservation from server state.

Observable A03/A05 examples:

1. Given an owned sector generated from a fixed seed, when the map starts, then its deposit count and gross budget are 8 small + 2 large = 160 scrap; each other owned sector has the same core-distance multiset and a reachable firing tile for every deposit. Three fixed seeds per player count plus property checks exercise this invariant.
2. Given 0 scrap and a 10-scrap small deposit at 10 health, when a legal shot destroys it, then the deposit vanishes and the shooter has 10 scrap; another shot or duplicate event pays nothing. A 40-scrap large deposit follows the same once-only rule.
3. Given exactly 10 scrap, a live core, and an empty front cell at Manhattan distance 8 in the owner's non-Belt sector, when the player builds a Wall, then one Wall appears and scrap becomes 0. At distance 9, the same request creates nothing and leaves 10 scrap.
4. Given 40 scrap and a front cell occupied by a pickup, enemy ship, core, turret, or deposit, when the player requests a Turret, then the request fails, the cell stays unchanged, and scrap remains 40. The same is true for a Belt cell or a cell in another sector.
5. Given 50 scrap and simultaneous `build Wall` plus `upgrade Blaster` requests, when the purchase stage runs, then Wall costs 10 first and the unaffordable Blaster is rejected; exactly 40 scrap remains. Repeating either action cannot spend the original 50 again.
6. Given a level-3 upgrade and sufficient scrap, when the player requests the same upgrade, then level and scrap remain unchanged and the HUD reports “MAX.” Given a destroyed core in battle, a build request is rejected even if the ship and scrap remain.

**Why only four items:** two fortify options and two arm options make the tradeoff readable from the shop bar alone. More items would need explaining.

**Why owners pass through their own walls:** a player can never trap themselves, so the server needs no rule against enclosing a core. Attackers have to shoot their way in.

**Why building is limited to your own base:** without the limit, a player could wall in an enemy core or plant turrets beside it. The limit keeps structures defensive.

## Combat

- The blaster is a beam. It hits the first thing in a straight line within range: an enemy ship, a structure, a core, or a deposit.
- A cooldown limits the fire rate.
- Turrets fire at the nearest enemy ship in range and ignore structures.
- There are no teams, so every other player is an enemy.

**Why a beam and not a moving projectile:** a beam resolves in a single tick. There are no bullet objects for the server to track and send, which keeps both the rules and the network traffic small.

### D2 combat collision and targeting contract — revision 2

<a id="d2-combat-collision-and-targeting-contract--revision-1"></a>

**Proposed, not accepted or implemented.** This revision supersedes package 1 in #26 and forms part of the [full D2 handoff](design/D2_HANDOFF.md) under [#29](https://github.com/MyNameIs-Nigel/packetscrapp/issues/29). It resolves beam priority, turret geometry, damage credit and hull healing; the lifecycle and duration contracts below and [D2 UI](design/D2_UI.md) complete the phase. Engineering and QA must review all revisions before dependent implementation. Starting values remain tuning hypotheses.

Positions, facings, structure placement, and alive/dead flags used for combat are those **after** that tick's movement stage and **before** fire resolution, matching [ARCHITECTURE.md](ARCHITECTURE.md) tick order (actions → move → fire → damage/deaths/drops/pickups → timers).

#### Blaster beams

- A living ship may queue at most one `fire` per tick. The shot resolves only if the ship's blaster cooldown has expired at the start of the fire stage. Cooldown is measured in whole ticks, rounding `tickRate / fireRate` upward (3 shots/s at 15 Hz → **5 ticks**). Every accepted shot starts cooldown, including a miss, a Belt-stopped shot, or a shot blocked by an owned structure. Rejected requests do not. A shot accepted at tick `t` permits the next at `t + 5`.
- The beam is a **cardinal ray** from the ship's facing at fire time. It never travels diagonally. Tile 1 is the adjacent cell in that facing; tiles continue through inclusive range `R` (starting blaster range 8). The ship's own tile is not a hit candidate.
- Build-phase Belt rule from D1 still applies: the beam stops at the first Belt cell and cannot affect a cell beyond it. Battle has no Belt stopper; sudden-death rays again stop at the first active Belt cell.
- Walk the ray from near to far. The first **blocking** occupant stops the beam and is the only combat target of that shot. Occupants are classified as:

| Occupant | Effect on the shooter's beam |
|---|---|
| Empty cell; scrap pickup | Pass through; pickups take no beam damage |
| Owned wall (shooter's wall) | Pass through; wall takes no damage |
| Owned turret (shooter's turret) | Block; turret takes no damage |
| Own core | Block; core takes no damage |
| Enemy ship, enemy wall, any deposit, enemy turret, enemy core | Block and become the shot's target |

If a ship occupies its own passable wall tile, test the wall before the ship. An enemy beam hits only that wall; destroying it does not retarget this tick's recorded shot. An owned wall remains transparent to its owner's beams. Other blocking structures cannot share a ship tile under D1.

- There is no friendly-fire damage to the shooter's own ship, walls, turrets, or core. Enemy walls always block before anything behind them, including a ship on a farther tile.
- Range boundary: a target on tile `R` may be hit; a target on tile `R + 1` may not. A wall on tile `R` blocks the beam there even if a ship sits on `R + 1`.
- Damage equals the shooter's current blaster damage from config/upgrades. The fire stage only records `(attackerSeat, targetRef, damage)`. The damage stage applies recorded hits.

#### Turrets

- Each turret with a contender owner may fire at most once per tick when its cooldown has expired (2 shots/s at 15 Hz rounds upward → **8 ticks** between accepted shots). Turrets never fire in `waiting` or `ended`; they fire in build, battle, and sudden death. Permanently eliminated owners' turrets remain blocking, damageable structures but stop firing after the elimination tick.
- Eligible targets are **living enemy ships** only. Turrets never target structures, deposits, cores, scrap, or the turret's owner.
- Range uses **Chebyshev** distance `max(|dx|, |dy|)` and is inclusive of the configured turret range (starting value 6).
- Line of sight is required. Trace the segment between tile centers using a **supercover**: include every intermediate cell whose closed square intersects the segment, excluding the source and target cells. At an exact grid corner include both orthogonal side cells as well as the diagonal cell. Compare integer/rational crossings exactly, so axis or rounding choices cannot change the covered set. Blockers are enemy walls, any turret, any core, any deposit, any ship other than the chosen target, and any active Belt cell. Scrap pickups and the turret owner's walls do not block. Also reject a target on an active Belt cell or behind an enemy wall sharing its target tile. If LOS fails, that ship is ineligible.
- Among eligible ships, choose the smallest Chebyshev distance. Distance ties break to the **lowest seatIndex**. If no eligible ship remains, the turret skips the tick and does not refresh cooldown.
- A turret shot is a beam that damages only the chosen ship for configured turret damage. It does not continue past the ship and does not damage intervening pass-through cells (LOS already required them to be clear of blockers).

**Decision:** turrets use Chebyshev range plus blocked grid LOS, with seatIndex as the only distance tie-break. **Why:** players can predict the square aura and a single nearest target without reading floating-point geometry, and Engineering can test ties without recording placement timestamps.

#### Damage stage, last-hit credit, and pickups

- Record all shots from the same post-movement snapshot before applying any damage. Apply blaster hits in ascending **attacker seatIndex**, then turret hits in ascending **(ownerSeatIndex, structureId)** where `structureId` is the server's stable placement id. A recorded shot still applies if its attacker or turret is destroyed later in this damage stage; it cannot retarget when a blocker is destroyed. Each hit subtracts from the target's current health after earlier hits. A hit whose target was already destroyed does nothing and pays nothing.
- When a hit reduces a deposit, wall, turret, ship, or core to health ≤ 0, that attacker receives last-hit credit for the destruction. Earlier hits the same tick still apply their damage but do not share payout. Deposit payout follows the D1 once-only scrap rule.
- Destroyed ships are removed before scrap drops resolve. The death drop creates one pickup on the death tile holding all unspent scrap. If that tile already holds a pickup, **merge** the amounts into a single pickup on that tile.
- Zero the dead seat's scrap as the pickup is created; a zero balance creates no pickup. After all damage, choose each dead ship's respawn eligibility using the core's final health this tick, independent of whether the ship or core hit was processed first. Apply active Belt lethality before choosing death transitions; a ship already killed by fire cannot drop again.
- After drops, each living ship occupying a tile that holds a pickup collects it: add the pickup scrap to that seat and remove the pickup. Movement already forbids two ships on one tile, so pickup collection needs no seat tie-break. A ship that dies on a tile does not collect a pickup on that tile in the same tick.

**Decision:** sequential seat-ordered damage inside one tick, not summed simultaneous HP math. **Why:** last-hit credit, overkill, and mid-tick destruction stay one rule for ships, structures, and deposits, and QA can step a single ordered list.

#### Hull-upgrade healing

- A successful hull upgrade increases maximum hull by the configured per-level bonus (starting value +50) and **restores current hull by the same bonus**, capped at the new maximum. Blaster upgrades do not change hull.
- If current hull was already at the old maximum, the ship becomes full at the new maximum. If damaged, the heal equals the max increase and does not fully repair prior damage beyond that bonus.

**Decision:** hull upgrades heal by the max-HP gain. **Why:** spending scrap on hull while wounded should still help immediately; a max-only increase would punish the upgrade timing without adding a readable tradeoff.

Observable A06 examples:

1. Given a shooter facing east with range 8 and an enemy wall on tile 3 with an enemy ship on tile 5, when the blaster fires, then only the wall is hit; the ship takes no damage.
2. Given the same geometry but the wall on tile 3 is owned by the shooter, when the blaster fires, then the beam passes the wall and damages the enemy ship on tile 5.
3. Given an enemy ship on tile 8 and another on tile 9, when the blaster fires at range 8, then the ship on tile 8 may be hit and the ship on tile 9 may not.
4. Given a build-phase ray whose first Belt cell is tile 2 and an enemy deposit on tile 3 beyond that Belt, when the blaster fires, then nothing beyond the Belt is damaged.
5. Given a turret and two enemy ships at Chebyshev distance 4 with clear LOS, seats 2 and 0, when the turret fires, then seat 0 is hit. If seat 0 is behind an enemy wall on the LOS path and seat 2 is clear, then seat 2 is hit.
6. Given a deposit at 10 health and two blaster hits of 10 damage from seats 3 then 1 recorded this tick, when damage applies in seat order, then seat 1's hit is applied first and receives the deposit payout; seat 3's hit finds no deposit.
7. Given 40 current hull, max 100, and a successful hull upgrade that adds 50 max, when the upgrade resolves, then max becomes 150 and current becomes 90.
8. Given an accepted empty shot at tick 20, when another fire request arrives at 24, then it is rejected; tick 25 permits a new shot. Turret shots at tick 20 permit another at 28, not 27.
9. Given a turret at `(0,0)` and an enemy at `(2,2)`, when an enemy wall occupies `(1,0)` or `(0,1)`, then the exact corner trace is blocked. An owner wall in either cell is transparent; a build-phase Belt cell there blocks too.
10. Given two final ships with destroyed cores each record a lethal hit at the other in the same fire snapshot, when seat-ordered damage applies, then both hits apply and both ships die; earlier seat order cannot cancel the second shot.
11. Given a ship and its core both receive lethal recorded hits this tick, when the ship hit is applied first or last, then it is permanently eliminated in both cases. One scrap drop is created and no respawn is scheduled.

## Cores, death, and respawn

- A destroyed ship drops all of its unspent scrap as a pickup on the tile where it died. Any ship can collect it.
- If the owner's core is alive, the ship respawns on its reserved neighboring tile after 15 seconds, subject to the lifecycle rules below.
- A core has its own health. Enemy shots damage it. It cannot be repaired.
- Once a core is destroyed, its owner's next death is permanent.

**Why 15 seconds:** in a five-minute match, 30 seconds is a tenth of the game spent watching. Fifteen is long enough to punish a death and give attackers a window.

**Why scrap drops on death:** it rewards kills, punishes hoarding, and gives a player a reason to spend before a risky move.

## Winning

- The last eligible contender wins, including a seat awaiting a legal respawn.
- If the final contenders become permanently eliminated on the same tick, they draw. Simultaneous ship deaths with living cores instead begin respawn waits.
- At 5:00, every remaining core shatters and the outer ring immediately becomes Belt. The proposed duration contract adds one ring every **2 seconds**, replacing the original 3-second hypothesis to meet the six-minute upper target.

**Why the Belt returns for sudden death:** it reuses a hazard players already understand, so the ending needs no new rule.

### D2 contender and win-draw contract — revision 2

<a id="d2-contender-and-win-draw-contract--revision-1"></a>

**Proposed, not accepted or implemented.** This revision supersedes package 2 in #28 as part of [#29](https://github.com/MyNameIs-Nigel/packetscrapp/issues/29). It corrects live-core simultaneous deaths, fixes one disconnect deadline across respawns, and specifies occupied spawn handling. Combat uses revision 2 above; phase boundaries and finite duration are below. D3/E5 still own reconnect identity and spectator admission.

Match tick order remains [ARCHITECTURE.md](ARCHITECTURE.md): actions → move → fire → damage/deaths/drops/pickups → timers → send views. Win/draw evaluation runs **once**, after the complete timer stage, using the final contender set. The boundary contract fixes ordering inside that stage.

#### Seat roles

Every admitted match seat is in exactly one role after each evaluation:

| Role | Meaning |
|---|---|
| `alive` | Has a living ship in the world (connected or inside disconnect grace). |
| `awaiting_respawn` | Ship destroyed, core living, timer running or deadline reached with the spawn tile blocked. |
| `permanently_eliminated` | Can no longer return a ship or win; becomes a spectator of this match when client connectivity allows. |

Disconnect grace (20 seconds = 300 ticks) overlays `alive` and `awaiting_respawn`; it is not a separate win role. A disconnect records one absolute expiry tick. Death or respawn while absent never restarts that deadline. An authenticated reconnect accepted strictly before expiry clears it; arrival at expiry is too late. D3/E5 specify transport identity and notices against this boundary.

#### Contender set

A seat is a **contender** iff its role is `alive` or `awaiting_respawn`. Spectators who were never players and permanently eliminated seats, including every seat whose disconnect grace expired, are **not** contenders. Evaluate this only after all current-tick deaths, expiries and core-loss transitions.

**Decision:** pending respawns and disconnect-grace ships stay contenders. **Why:** a player waiting 15 seconds to respawn, or briefly offline with a ship still on the map, must not hand the match to someone else by temporary absence.

#### Transitions

- **Ship destroyed, core living:** role becomes `awaiting_respawn`; death at tick `t` sets respawn deadline `t + 225` (15 s). Scrap drop rules from the bullets above apply. Upgrades persist.
- **Respawn timer completes:** if the core still lives and disconnect grace has not expired, spawn one ship at the reserved D1 tile, facing the D1 default, hull at current max. Clear queued actions and movement/fire intent; the blaster is ready for a fresh request next tick. If another ship blocks the tile, remain `awaiting_respawn` and retry each subsequent timer stage without moving or damaging the occupant. Never relocate, stack ships, or restart the 15-second timer. Core loss or disconnect expiry still cancels the wait.
- **Ship destroyed, core already destroyed:** role becomes `permanently_eliminated` immediately (no respawn timer).
- **Core destroyed while `alive`:** core is gone and cannot be repaired; role stays `alive` until the ship dies, then `permanently_eliminated` (the “next death is permanent” rule).
- **Core destroyed while `awaiting_respawn`:** cancel the respawn timer; role becomes `permanently_eliminated` immediately. **Why:** there is no living ship to continue and no legal respawn without a core; waiting out a timer would falsely keep them a contender.
- **Disconnect while `alive`:** keep the ship in world for the grace window; seat stays a contender. Damage, Belt, and turrets still apply. No gameplay actions are accepted from the missing client.
- **Disconnect grace expires while `alive` with core living:** remove the ship without a scrap-drop-on-death (the seat abandoned the ship); do **not** start a respawn; role becomes `permanently_eliminated`. The abandoned core remains an inert damageable target but that seat is no longer a contender. **Why:** reconnect identity is D3, but expiry must not leave an immortal empty contender or let pull-the-plug dodge elimination forever.
- **Disconnect grace expires while `alive` with core already destroyed:** remove the ship; role `permanently_eliminated` (same end state).
- **Disconnect while `awaiting_respawn`:** respawn timer continues. The same 300-tick disconnect deadline applies before and after spawning; no fresh grace is granted. On expiry cancel any pending respawn and permanently eliminate the seat, even if its core lives. Core loss during the wait also eliminates immediately.
- **Voluntary match departure:** permanently eliminate immediately, cancel respawn/input, and remove any living ship using the same no-drop abandonment rule as grace expiry. It cannot be used to rejoin as a player. D3/E5 must distinguish authenticated voluntary departure from an accidental socket loss in the message/transport contract; D2 supplies the role outcome and confirmation copy. Unspent abandoned scrap is removed from the economy, never copied to a future seat.
- **Build-phase Belt death:** same as any ship destruction: `awaiting_respawn` if the core lives. Build continues; this does not end the match by itself.

Permanent elimination never removes other seats' cores or structures except through ordinary combat damage.

On either disconnect expiry or voluntary departure, zero the abandoned seat's unspent scrap when removing its ship or canceling its respawn. Create no abandonment pickup and carry no balance into a watcher or new room. Scrap dropped by an earlier real death remains in the world; abandonment never deletes or duplicates that existing pickup. A winner or draw can end build before tick 1800, using the same final contender evaluation and results window as later phases; ending early does not reveal the hidden build world.

| Current role | Event / condition | Next role and timer |
|---|---|---|
| `alive` | Ship dies, core lives after all damage | `awaiting_respawn`, deadline `t+225` |
| `alive` | Ship dies, core destroyed after all damage | `permanently_eliminated`, no timer |
| `alive` | Core destroyed, ship survives | `alive`, future death cannot respawn |
| `awaiting_respawn` | Core destroyed, including sudden-death shatter | `permanently_eliminated`, cancel timer |
| `awaiting_respawn` | Deadline due, core lives, tile clear, grace valid | `alive`, one ship; remove timer |
| `awaiting_respawn` | Deadline due, reserved tile occupied | `awaiting_respawn`, retry without resetting deadline |
| Either contender role | Disconnect, grace not expired | Same role, one fixed expiry `t+300` |
| Either contender role | Grace expires or authenticated departure | `permanently_eliminated`, cancel all pending actions/timers |
| `permanently_eliminated` | Any respawn, gameplay or seat-recovery request | Remains eliminated; request rejected |

#### Win and draw evaluation

Let `C` be the contender set after deaths and timer transitions on this tick.

1. If `|C| = 1`, that seat **wins**. Enter `ended` with a single winner. A sole contender who is `awaiting_respawn` still wins; they do not need a living ship sprite at the declaration tick.
2. If `|C| = 0`, the match is a **draw** among every seat that **left the contender set on this tick** (same-tick mutual elimination). If somehow no seat left this tick either (should not occur after match start), treat as a draw among all seats that were contenders at match start—an Engineering assert/fixture failure, not a silent continue.
3. If `|C| ≥ 2`, the match continues. Phase changes (build→battle, battle→sudden_death) do not by themselves declare a winner.

Same-tick examples: two final ships die with **destroyed cores** → both leave the contender set → draw. If both cores live, both become `awaiting_respawn`, `|C| = 2`, and play continues. If just one core lives, that seat remains a contender and wins while awaiting respawn.

**Decision:** evaluate once after the complete timer stage. **Why:** core shatter, hazard expansion, respawn and expiry must all settle before counting contenders; a pending respawn already counts without requiring a sprite.

Results last **15 seconds (225 ticks)** from the ending tick; gameplay stops immediately, then the room disposes and disconnects remaining clients. An empty ended room disposes immediately. Departed or eliminated seats never regain gameplay authority. D3 owns watcher admission and Play Again routing; [D2 UI](design/D2_UI.md) owns ending copy and focus.

Observable A06/A07 examples:

1. Given seats 0 and 1 both `alive`, when seat 0's ship dies and its core lives, then seat 0 is `awaiting_respawn` and still a contender; the match does not enter `ended`.
2. Given seat 0 `awaiting_respawn` and seat 1 `alive` as the only contenders, when seat 1's ship dies and seat 1's core is already destroyed, then seat 1 is `permanently_eliminated`, `|C| = 1`, and seat 0 wins while still awaiting respawn.
3. Given seats 0 and 1 as the only contenders, both with destroyed cores, when both ships reach 0 hull in the same damage stage, then both leave the contender set and draw. With both cores living they instead await respawn and the match continues; with only seat 0's core living, seat 0 wins while awaiting respawn.
4. Given seat 0 `awaiting_respawn` with a living core and seat 1 `alive`, when seat 0's core is destroyed before the respawn timer fires, then seat 0 becomes `permanently_eliminated` immediately and, if seat 1 remains the only contender, seat 1 wins.
5. Given seat 0 `alive` inside disconnect grace with a living core and seat 1 `alive`, when the grace expires, then seat 0's ship is removed, seat 0 is `permanently_eliminated` (not a contender), seat 0's core may remain as a target, and the match ends only if seat 1 is then the sole contender.
6. Given three contenders and seat 2 permanently eliminated earlier, when only seat 0 remains in `C`, then seat 0 wins; seat 2 is not placed in a draw set.
7. Given a death at tick 100 and a living core, when tick 324 finishes, then the seat still awaits respawn. At timer stage 325 it spawns if the reserved tile is clear. If occupied, it waits; once clear it spawns exactly once. Destroying the core during this wait eliminates it.
8. Given disconnect at tick 100 and a respawn at tick 325, when tick 400 arrives without reconnect, then the seat is eliminated; spawning did not extend the deadline to 625. Reconnect accepted at 399 is valid; at 400 it is rejected.
9. Given two build-phase contenders and seat 0 voluntarily leaves with 40 scrap, then seat 0 is eliminated with zero balance and no new pickup; seat 1 wins before battle. Any pickup from an earlier death remains unchanged, and the result view does not expose the other sector.

### D2 phase boundaries and finite duration — revision 1

**Proposed under #29.** This is package 3 of the full D2 contract. Match ticks start at 1; waiting time is outside the match clock. Match time after tick `t` is `t / 15` seconds. Every timer uses absolute integer ticks. Render countdowns from server deadlines, never client wall-clock authority.

| Tick / timer stage | Required behavior |
|---|---|
| 1–1799 | Actions, movement, fire and damage use build rules and private views. |
| 1800 (120 s) | Actions through damage still use build rules: a ship entering internal Belt dies; a shot cannot cross it. In timers remove internal Belt, set battle, then resolve due respawns. Publish the complete battle view in this tick's send stage. Tick 1801 is the first tick whose actions use battle rules. |
| 1801–4499 | Battle actions; no internal Belt. Normal core-backed respawns continue. |
| 4500 (300 s) | Actions through damage use battle rules. In timers enter sudden death: shatter all remaining cores without damage credit or scrap rewards, cancel all pending respawns, add outer ring 0, kill ships in that ring, then evaluate contenders. A respawn due on this tick never spawns. |
| `4500 + 30*k`, `k ≥ 1` | Add ring `k`, kill every ship on newly hazardous cells, then evaluate contenders. All earlier rings stay lethal. |
| Ending tick `e` | Publish one immutable winner/draw result after timer transitions; clear queued actions and freeze gameplay/elapsed match time. Continue the room's disposal timer; dispose at `e + 225`, or immediately if no clients remain. |

Within every timer stage: apply any phase/ring transition and its core loss first; kill ships on newly active Belt with the same once-only death/drop rule; process disconnect expiry; process due legal respawns; evaluate win/draw once. A core killed in ordinary damage on a respawn deadline likewise prevents respawn. Phase changes do not resurrect a seat or reset a disconnect deadline. New spawns cannot act until the next tick.

The active sudden-death Belt kills ships entering it in the ordinary damage stage, before pickup collection. New ring kills occur in timers after ordinary pickups, so drops from a ring kill are available only from the next tick; they cannot be collected by a ship killed on that ring. Pickups may remain in Belt until disposal. Newly hazardous structures/deposits can remain visible but give no protection: hull, walls, cores, upgrades, occupancy and absence do not prevent hazard lethality. Shots stop at active Belt cells in every phase.

For a `W × H` board, cell `(x,y)` is in ring `min(x, y, W-1-x, H-1-y)`. At shrink step `k`, every cell with ring index `≤ k` is lethal. Thus `N = ceil(min(W,H) / 2)` steps cover the entire board, including a final single row/column on an odd-sized board. Step 0 is immediate at 4500; the final step occurs at `4500 + 30*(N-1)`. Cores already shattered, so every seat then lacks both a living ship and a legal respawn. The contender set is empty or play ended earlier. The proof applies to every seed, placement, enclosure, disconnected seat and no-action match.

| Participants | Board | Rings `N` | Latest ending tick | Maximum match duration | Latest disposal with connected clients |
|---|---|---:|---:|---|---|
| 2 | 48 × 24 | 12 | 4830 | 322 s = 5:22 | Tick 5055 = 5:37 |
| 3 | 48 × 48 | 24 | 5190 | 346 s = 5:46 | Tick 5415 = 6:01 |
| 4 | 48 × 48 | 24 | 5190 | 346 s = 5:46 | Tick 5415 = 6:01 |
| 5 | 72 × 48 | 24 | 5190 | 346 s = 5:46 | Tick 5415 = 6:01 |

**Decision:** propose immediate ring 0 and a 2-second cadence. **Why:** the former 3-second value yields 369 seconds (6:09) for the 48-high maps even with an immediate first ring, exceeding the six-minute match target. Two seconds gives a 5:46 maximum while keeping the existing 120/300-second boundaries. Early wins can finish sooner than five minutes; five-to-six minutes is a pacing target, not a minimum. Lobby and results time are excluded. These are simulation-time bounds; Q3 must separately measure real-time matches and Q5 must qualify tick performance under load. A stalled process has no real-time guarantee from this paper proof.

Observable A06/A07 boundary cases:

1. At tick 1799 enemy data remains absent. On 1800 a move into internal Belt is lethal before removal; the emitted state is battle and contains the full world. On 1801 the former internal boundary is traversable.
2. A legal respawn due 4499 may spawn. One due 4500 is canceled by core shatter. A waiting contender eliminated by this transition cannot resurrect at 4501.
3. At tick 4500 `(0,10)` becomes lethal; `(1,10)` is safe if not near another edge. At 4529 it remains safe; at 4530 ring 1 kills it. No hull upgrade or wall shields the ship.
4. On the 48 × 24 board, the last central rows `y=11,12` become lethal at 4830. On the 48-high boards, `y=23,24` become lethal at 5190. A no-action fixture cannot still have a contender after those ticks.
5. With two final pending respawns at 4500, core shatter eliminates both and the result is a draw among those two. If a living third contender survives ring 0, that seat wins instead.
6. At ending tick `e`, all clients receive the same result; gameplay requests thereafter cannot mutate it. At `e+224` results still exist with clients connected; at `e+225` the room is disposed. A delayed client transitions to a readable expiry state rather than silently rejoining as a player.

## Joining a match

- **No accounts.** A player enters a nickname of up to 16 characters and plays. *Why:* sign-up and sign-in reduce player counts, and the game has nothing to save.
- **Quick Play** puts the player in an open lobby on the selected region, or creates one.
- **Private room** creates a lobby with a shareable link. The host starts the match and can add a bot. *Why:* friends need to wait for each other, so a private room must not start on a timer.
- A Quick Play lobby starts 15 seconds after the first player joins, or at once when it reaches 5 players.
- Matches lock at the start. Nobody joins as a player mid-match. *Why:* a late joiner would have no build phase and no chance.

## The bot

- A bot joins a Quick Play lobby if the countdown ends with only one human in it.
- The bot is clearly labelled as a bot.
- It plays by the same rules through the same actions as a human. Proposed D3 makes reachable-deposit harvesting, alternating wall/blaster spending, visible enemy-core attacks and stuck/hazard recovery precise in the linked bot contract below.

**Why label it:** many browser games pass bots off as people. In an open-source game anyone can read that in the code, and a player who feels tricked does not come back.

**Why one bot per match at most:** the bot exists so a solo visitor can play. It is not meant to pad lobbies.

## Spectators

- The start page lists live matches on the selected region.
- Spectators can watch a match only after the Belt drops. Before that they see a countdown.
- Eliminated players become spectators of their own match.
- Proposed D3: ten external watcher slots, including build waiters, plus up to five former player connections retained after elimination; see the role/cap contract below.

**Why not during the build phase:** base layouts are secret until the Belt drops. A spectator could pass a rival's layout to a friend in the match.

**Why a cap:** every spectator is a connection the server has to send state to.

## What a player sees

- **Build phase:** only their own sector. Other sectors are hidden.
- **Battle phase:** the whole map.

**Why all-or-nothing visibility:** hiding other bases during the build phase is what matters for fairness. Switching visibility once per match is simple and cheap. A moving line-of-sight radius would mean recalculating what each player can see on every tick.

## Screen layout

- The [D1 text wireframes](design/D1_UI.md) define start, lobby, and build HUD; proposed [D2 UI states](design/D2_UI.md) complete combat, death, respawn, elimination and results. They are contracts for review, not browser evidence.
- Top center: the phase name and the clock, for example "WALLS DROP 0:47".
- Top left: hull bar and core health bar.
- Top right: the other players, with a marker showing whether each core is alive.
- Bottom center: the shop bar with keys, costs, and current scrap.

## Starting numbers

All of these live in `shared/config.ts` and will change with playtesting.

| Setting | Value |
|---|---|
| Server tick rate | 15 per second |
| Sector size | 24 × 24 tiles |
| Belt thickness | 2 tiles |
| Build phase | 120 s |
| Sudden death starts | 300 s |
| Sudden death Belt speed | Proposed D2: ring 0 immediately at 300 s, then 1 ring every 2 s (30 ticks) |
| Lobby countdown | 15 s |
| Respawn delay | 15 s |
| Results display window | Proposed D2: 15 s (225 ticks), empty room disposes immediately |
| Ship speed | 1 tile every 2 ticks |
| Ship hull | 100, plus 50 per hull level |
| Blaster damage | 10, plus 5 per blaster level |
| Blaster fire rate | 3 shots per second |
| Blaster range | 8 tiles |
| Core health | 300 |
| Wall health | 60 |
| Turret health, damage, range, fire rate | 80, 8, 6 tiles, 2 per second |
| Small deposit health and payout | 30 health, 10 scrap |
| Large deposit health and payout | 90 health, 40 scrap |
| Build radius around the core | 8 tiles |
| Spectator cap per match | Proposed D3: 10 external watchers plus up to 5 retained former player connections |

## Known balance risks

- **Blaster upgrades also speed up harvesting**, because harvesting is shooting. This may make arming strictly better than fortifying. If playtests show that, switch harvesting to a fixed rate that ignores blaster level.
- **Full wall enclosures** may make cores too safe before sudden death. Wall health and cost are the levers.
- **Scrap drop on death** can snowball a lead. Dropping half instead of all is the fallback.

## D3 multiplayer journey contract — revision 1

**Proposed under [#33](https://github.com/MyNameIs-Nigel/packetscrapp/issues/33), not accepted or implemented.** The [complete journey contract](design/D3_JOURNEYS.md) is the authoritative detailed extension of joining, bot, spectator and replay rules above; its [handoff](design/D3_HANDOFF.md) records dependencies and review ownership. D0/D1 remain accepted; D2 lifecycle revision 2 is still separately proposed.

| Rule slice | Exact player behavior and review target |
|---|---|
| [Lobby and private host](design/D3_JOURNEYS.md#joining-and-lobby-contract) | Absolute Quick Play deadline, one solo BOT, atomic start/admission, friend replaces private BOT before start, host departure/transfer, five-minute private inactivity proposal. |
| [Roles and watchers](design/D3_JOURNEYS.md#roles-and-allowed-actions) | Ten external watchers, up to five retained former players, private unlisted watch links, metadata-only build wait and eliminated-role filtering. |
| [Reconnect and replay](design/D3_JOURNEYS.md#reconnect-departure-and-replay) | Bound seat identity, strict 300-tick expiry, vulnerable absent ships, acknowledged leave, fresh private replay link/host and results cleanup. |
| [Solo opponent](design/D3_JOURNEYS.md#bot-opponent-contract) | Filtered visible-state inputs, legal deterministic harvest/spend/navigation/attack priorities, blocked-path and no-resource behavior; playable fixture criteria without human win-rate claims. |
| [Regions and keyboard journeys](design/D3_JOURNEYS.md#regions-links-and-live-lists) | Saved preference/fallback, region-bound links, typed failure recovery, safe public live list and copy/focus paths. |

**Decision:** publish every happy, unavailable and recovery path as proposed examples before E5/E6 implement them. **Why:** host powers, hidden build information, reconnect expiry and watcher capacity must not be guessed from UI or code. Engineering reviews feasibility/messages and QA accepts the [J01–J20 oracles](design/D3_JOURNEYS.md#observable-acceptance-scenarios). Runtime G5 still requires E5/E6/Q4 and D4 evidence; this contract closes no gate.
