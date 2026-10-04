# Vision

Planning baseline for October 2026; milestones below are targets, not completed delivery.

## The pitch

Harvest scrap behind an asteroid belt for two minutes, choose between fortifying your core and arming your ship, then fight to be the last one standing when the belt drops.

Packet Scrapp is the Minecraft "Walls" format with a Bed Wars-style core, compressed into a five-minute browser match for 2 to 5 players.

## Project requirements

The October project has three hard requirements. Every other decision serves them.

1. At least two players can join from separate devices.
2. The game has real rules a player can follow without anyone explaining them.
3. It is live at a URL other people can reach: `https://packetscr.app`.

## Design pillars

### Playing within ten seconds of opening the link

A player types a nickname and presses Quick Play. There are no accounts.

**Why:** every step between the link and the game loses players, and a sign-up form loses the most. A small game needs every visitor it gets, because a multiplayer game with nobody online is not playable at all.

### Rules you learn by playing

The game has three verbs: move, shoot, build. The timer, the Belt, and the shop prices are always on screen.

**Why:** requirement 2. A player who dies in the Belt once has learned the Belt rule. A player who sees "WALLS DROP 0:12" knows what is coming. Anything that needs a paragraph of explanation gets cut.

### Short matches

A match ends in about five to six minutes, guaranteed by sudden death.

**Why:** short matches are where "one more game" comes from. They also keep a lost match cheap, which matters when a server restart or a disconnect ends one early.

### Fun with exactly two

The game must work with two players, and a bot fills in when only one human is online.

**Why:** a new game rarely has five people online at once. If the design needs a full lobby, most visitors will see an empty room and leave.

### Fair by construction

The server decides everything, and the source is public.

**Why:** an open-source game cannot rely on hiding how it works. If the server validates every action and never sends a player information they should not have, reading the code does not grant authority over the game state. Automation and abuse still require limits and testing.

### Cheap to run

Target a small hosting budget, with server capacity and provider costs validated before launch. Include isolated development infrastructure in that budget.

**Why:** a hobby project that costs real money each month gets shut down. A grid-based, tick-based design keeps the server light enough that a small machine may be sufficient; load tests determine the safe room limit.

## Fiction

Players are salvage ships working a debris field. The resource is **scrap**. Each ship is tethered to a **core**, which rebuilds the ship when it is destroyed. An asteroid belt, **the Belt**, separates the salvage claims until it disperses.

The fiction is deliberately thin. It exists to make the rules feel natural, and any of the names can change.

## Not in October

| Not building | Why |
|---|---|
| Accounts, progression, leaderboards | They need persistence and moderation, and they slow down joining. |
| Teams | Balancing teams with 2 to 5 players is hard. Free-for-all works at every player count. |
| Text chat | Open chat needs moderation, which a solo developer cannot provide. |
| Touch controls | Keyboard first. Touch is a stretch goal once the game is fun on desktop. |
| Skill-based matchmaking | There will not be enough players to split by skill. |
| Moving a live match between servers | Match state lives in memory. A five-minute match is cheap to lose. |
| Sound and music | Stretch goal. They do not affect whether the game works. |

## October delivery targets

The [parallel delivery plan](DELIVERY_PLAN.md) replaces the original serial weekly allocation. [Design](design/README.md), [Engineering / Programming](engineer/README.md), and [QA](qa/README.md) each have independent phases with explicit artifact dependencies and shared acceptance gates. Dates are forecasts; evidence determines completion.

| Window | Shared target |
|---|---|
| Oct 3 to 10 | Agree first contracts and tests; connect two browsers with server-owned movement; start isolated development deployment |
| Oct 11 to 17 | Verify the harvest/build loop while combat contracts and delivery/rollback work advance |
| Oct 18 to 24 | Complete combat and bounded endings; integrate bot/private/reconnect paths and regional/spectator flows; run playtests |
| Oct 25 to 31 | Close player-journey, balance, capacity, recovery, and release gates; launch only when accepted |

**Decision:** deploy a development prototype early and reserve production for the launch gate. **Why:** DNS, certificates, runtime limits, and hosting access need early proof, but the required release/rollback, draining, and full-match smoke evidence cannot be replaced by a calendar date. The former week-one public-release target is superseded; development deployment is not public-game completion.

**Decision:** prepare both regional delivery paths early, while implementing player-facing selection and spectators after their contracts are ready. **Why:** one connected server is enough to develop the core rules, but discovering Atlanta access or approved-update failures in the final week would put launch at risk. See the delivery plan for independently startable work packages.

The ten-second entry pillar, 15-second Quick Play lobby, and five-to-six-minute match target need explicit measurement and boundary decisions in D0/D2 before implementation. Their current wording is design intent, not proof that the starting numbers satisfy every layout.

## How to tell it worked

- Two people on different networks finish a match without help.
- A first-time player understands the goal before their first match ends, without being told.
- A solo visitor gets a match against the bot within 20 seconds.
- Stopping the New York server sends new players to Atlanta without anyone changing a setting.

## Operational acceptance

A public launch also requires CI checks, isolated development and production, a tested release/rollback path, working alerts, and the smoke tests in [ENGINEERING.md](ENGINEERING.md). Main changes ship to development; only approved stable releases update the public game. See [DEPLOYMENT.md](DEPLOYMENT.md).
