# Vision

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

**Why:** an open-source game cannot rely on hiding how it works. If the server validates every action and never sends a player information they should not have, reading the code gives a cheater nothing.

### Cheap to run

The whole game runs on a $4 droplet plus free tiers.

**Why:** a hobby project that costs real money each month gets shut down. A grid-based, tick-based design keeps the server light enough that the smallest machine is plenty.

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

## October plan

| Week | Dates | Goal |
|---|---|---|
| 1 | Oct 3 to 10 | Two browsers move ships in the same room, deployed end to end at `packetscr.app` |
| 2 | Oct 11 to 17 | Build phase: the Belt, harvesting, the shop, building |
| 3 | Oct 18 to 24 | Battle: combat, cores, respawn, sudden death, win screen, the bot |
| 4 | Oct 25 to 31 | Regions and health checks, spectators, playtests, tuning |

**Why deploy in week 1:** requirement 3 is the one that depends on things outside the code, such as DNS, certificates, and the droplet. Solving it first means every later week ships to a real URL, and deployment problems surface while there is still time to fix them.

**Why regions come last:** the game needs one working server before it needs two. The health endpoint is cheap and ships in week 1 because deploys use it too. Only the second region and the picker wait until week 4.

## How to tell it worked

- Two people on different networks finish a match without help.
- A first-time player understands the goal before their first match ends, without being told.
- A solo visitor gets a match against the bot within 20 seconds.
- Stopping the New York server sends new players to Atlanta without anyone changing a setting.
