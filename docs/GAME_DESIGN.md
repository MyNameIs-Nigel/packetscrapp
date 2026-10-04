# Game design

Design specification; gameplay is not implemented yet. Rule changes should include deterministic tests and a compatibility review under [ENGINEERING.md](ENGINEERING.md).

The [Design phase plan](design/README.md) schedules rule, map, balance, and UI decisions. The [shared decision register](DELIVERY_PLAN.md) identifies unresolved edge cases and their owners; Engineering must use accepted contracts and QA checks them through the [acceptance matrix](qa/ACCEPTANCE_MATRIX.md). Starting values below remain hypotheses until validated.

## Summary

Packet Scrapp is a free-for-all for 2 to 5 ships on a tile grid. Each player has a ship and a core. Destroyed ships respawn at their core until the core is destroyed. The last player with a ship wins.

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

**Decision:** shots fired during build stop at the first Belt cell and cannot hit a neighboring sector. **Why:** the lethal crossing hazard must not let a player raid an unseen base from safety. Full beam collision priority belongs to D2; this boundary rule is enough for E1 visibility and E3 harvest preparation.

Observable examples for A02–A04:

1. Given the left ship on `(22, 11)` in a two-player build, when it moves right on a movement tick, then it enters Belt cell `(23, 11)` and dies that tick. No ship reaches `(24, 11)` before battle.
2. Given a ship at `(0, 8)` facing left, when it holds left, then position and facing remain unchanged; when it subsequently moves down to `(0, 9)`, facing becomes down.
3. Given adjacent ships trying to swap tiles on the same tick, then neither moves. Given two ships targeting the same empty tile, neither moves.
4. Given a player firing east at a deposit in their own sector with the Belt behind it, then the deposit may take a legal hit; a target beyond the first Belt cell takes none.
5. Given fixed seeds, participant join order, and each player count, then the advertised world size, sector assignment, reserved core/spawn cells, and Belt coordinates match the table. A new build-phase client's received state contains no enemy or unowned-sector entities. At battle reveal, the Belt disappears and the full map becomes visible.

## The Belt

During the build phase, bands of asteroids two tiles thick run along every sector border. A ship that enters a Belt tile is destroyed at once.

- The owner respawns at their core after the normal respawn delay.
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

**Why only four items:** two fortify options and two arm options make the tradeoff readable from the shop bar alone. More items would need explaining.

**Why owners pass through their own walls:** a player can never trap themselves, so the server needs no rule against enclosing a core. Attackers have to shoot their way in.

**Why building is limited to your own base:** without the limit, a player could wall in an enemy core or plant turrets beside it. The limit keeps structures defensive.

## Combat

- The blaster is a beam. It hits the first thing in a straight line within range: an enemy ship, a structure, a core, or a deposit.
- A cooldown limits the fire rate.
- Turrets fire at the nearest enemy ship in range and ignore structures.
- There are no teams, so every other player is an enemy.

**Why a beam and not a moving projectile:** a beam resolves in a single tick. There are no bullet objects for the server to track and send, which keeps both the rules and the network traffic small.

## Cores, death, and respawn

- A destroyed ship drops all of its unspent scrap as a pickup on the tile where it died. Any ship can collect it.
- If the owner's core is alive, the ship respawns at the core after 15 seconds.
- A core has its own health. Enemy shots damage it. It cannot be repaired.
- Once a core is destroyed, its owner's next death is permanent.

**Why 15 seconds:** in a five-minute match, 30 seconds is a tenth of the game spent watching. Fifteen is long enough to punish a death and give attackers a window.

**Why scrap drops on death:** it rewards kills, punishes hoarding, and gives a player a reason to spend before a risky move.

## Winning

- The last player with a ship wins.
- If the final ships are destroyed on the same tick, the match is a draw between them.
- At 5:00, every remaining core shatters. From then on, the outer ring of the map turns into Belt every 3 seconds.

**Why the Belt returns for sudden death:** it reuses a hazard players already understand, so the ending needs no new rule.

## Joining a match

- **No accounts.** A player enters a nickname of up to 16 characters and plays. *Why:* sign-up and sign-in reduce player counts, and the game has nothing to save.
- **Quick Play** puts the player in an open lobby on the selected region, or creates one.
- **Private room** creates a lobby with a shareable link. The host starts the match and can add a bot. *Why:* friends need to wait for each other, so a private room must not start on a timer.
- A Quick Play lobby starts 15 seconds after the first player joins, or at once when it reaches 5 players.
- Matches lock at the start. Nobody joins as a player mid-match. *Why:* a late joiner would have no build phase and no chance.

## The bot

- A bot joins a Quick Play lobby if the countdown ends with only one human in it.
- The bot is clearly labelled as a bot.
- It plays by the same rules through the same actions as a human. It harvests the nearest deposit, alternates spending between walls and blaster upgrades, and after the Belt drops it heads for the nearest enemy core.

**Why label it:** many browser games pass bots off as people. In an open-source game anyone can read that in the code, and a player who feels tricked does not come back.

**Why one bot per match at most:** the bot exists so a solo visitor can play. It is not meant to pad lobbies.

## Spectators

- The start page lists live matches on the selected region.
- Spectators can watch a match only after the Belt drops. Before that they see a countdown.
- Eliminated players become spectators of their own match.
- Each match allows at most 10 spectators.

**Why not during the build phase:** base layouts are secret until the Belt drops. A spectator could pass a rival's layout to a friend in the match.

**Why a cap:** every spectator is a connection the server has to send state to.

## What a player sees

- **Build phase:** only their own sector. Other sectors are hidden.
- **Battle phase:** the whole map.

**Why all-or-nothing visibility:** hiding other bases during the build phase is what matters for fairness. Switching visibility once per match is simple and cheap. A moving line-of-sight radius would mean recalculating what each player can see on every tick.

## Screen layout

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
| Sudden death Belt speed | 1 ring every 3 s |
| Lobby countdown | 15 s |
| Respawn delay | 15 s |
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
| Spectator cap per match | 10 |

## Known balance risks

- **Blaster upgrades also speed up harvesting**, because harvesting is shooting. This may make arming strictly better than fortifying. If playtests show that, switch harvesting to a fixed rate that ignores blaster level.
- **Full wall enclosures** may make cores too safe before sudden death. Wall health and cost are the levers.
- **Scrap drop on death** can snowball a lead. Dropping half instead of all is the fallback.
