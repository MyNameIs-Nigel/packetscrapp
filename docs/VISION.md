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

### Joining a connected lobby within ten seconds of Quick Play

A player types a nickname and presses Quick Play. There are no accounts. The ten-second target measures from pressing Quick Play with a valid nickname to entering a connected lobby on the agreed test network. It does not include time spent typing, the lobby countdown, or the start of the build phase. A solo player's separate target is to start the build phase against a labelled bot within 20 seconds of pressing Quick Play.

**Why:** every step between the link and the lobby loses players, and a sign-up form loses the most. The 15-second Quick Play countdown gives another person time to join; calling that wait "playing within ten seconds" would promise an impossible solo start.

### Rules you learn by playing

The game has three verbs: move, shoot, build. The timer, the Belt, and the shop prices are always on screen.

**Why:** requirement 2. A player who dies in the Belt once has learned the Belt rule. A player who sees "WALLS DROP 0:12" knows what is coming. Anything that needs a paragraph of explanation gets cut.

### Short matches

A match targets about five to six minutes; early victories may finish sooner. The proposed [D2 duration contract](GAME_DESIGN.md#d2-phase-boundaries-and-finite-duration--revision-1) bounds simulation time at 5:22 for two players and 5:46 for three through five, excluding lobby and results. Its two-second shrink cadence awaits Engineering/QA acceptance; real-time duration still requires Q3 and performance evidence.

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

**Decision:** prepare both delivery paths early, the Atlanta development builder and the New York production release, while implementing player-facing selection and spectators after their contracts are ready. **Why:** one connected server is enough to develop the core rules, but discovering Atlanta access, builder, or release failures in the final week would put launch at risk. See the delivery plan for independently startable work packages.

The accepted D0 [scope and entry record](design/D0_SCOPE.md) defines the ten-second lobby and 20-second solo measures separately from the 15-second countdown. PR #3 records Engineering/QA acceptance of these measurement boundaries; actual runtime timings remain unverified. D2 still must prove the five-to-six-minute match bound for every layout; the starting numbers alone do not establish it.

## How to tell it worked

- Two people on different networks finish a match without help.
- In an uncoached first match, a new player can explain the objective and core/respawn rule when asked immediately after the results appear; D4 samples at least five first-time players and targets four correct explanations.
- A solo visitor enters the build phase against a visibly labelled bot within 20 seconds of pressing Quick Play on the agreed test network.
- Stopping the New York server shows new players a clear offline notice with a retry button, and the external monitor alerts the maintainer.

## Operational acceptance

A public launch also requires CI checks, isolated development and production, a tested release/rollback path, working alerts, and the smoke tests in [ENGINEERING.md](ENGINEERING.md). Main changes ship to development; only approved stable releases update the public game. See [DEPLOYMENT.md](DEPLOYMENT.md).
