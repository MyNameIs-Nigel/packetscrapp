# Architecture

Design specification. E1 implements the connected-room slice described below: admission, a roster-only waiting room, the 15 Hz movement simulation (in a labelled local prototype), per-seat state views, input limits, origin policy and canonical health. Match lifecycle, combat, economy, reconnection and deployment are not implemented; see [E1_EVIDENCE.md](engineer/E1_EVIDENCE.md). The diagram shows the planned production topology. Development runs the client and one server together on the Atlanta host, as described in [DEPLOYMENT.md](DEPLOYMENT.md).

## Components

```mermaid
flowchart LR
  B[Browser client]
  V[Vercel CDN<br/>packetscr.app]
  N[New York server<br/>nyc.packetscr.app]
  B -- static files over HTTPS --> V
  B -- GET /health --> N
  B -- game traffic over wss --> N
```

Production starts with one region. Further regions join the client's region list and receive the same health checks; see [REGIONS_AND_HEALTH.md](REGIONS_AND_HEALTH.md).

- **The client** is static files. It draws the game, reads the keyboard, and sends actions.
- **Each game server** is one Node process running Colyseus. It holds every match on that server in memory.
- **Servers do not talk to each other.** Each region is independent.

**Why no central matchmaker:** a matchmaking service would be one more thing to host and one more thing that can fail. The client picks a region from a list shipped in its own bundle, so a region going down never takes the others with it.

## Authority

The server owns the game state. Clients send what they want to do, and the server decides what happens.

- A client never sends a position, a health value, or a scrap total.
- The server owns the clock, so phase changes and cooldowns cannot be sped up from a browser.
- The client draws what the server reports.

**Why:** the code is public, so a cheater can read and modify the client freely. When the client has no say in the outcome, the server can reject illegal actions; automation and other abuse still require explicit limits.

## Tick loop

The server advances every match 15 times a second. Each tick runs in this order:

1. Apply queued player and bot actions, at most one of each kind per player.
2. Move ships.
3. Resolve blaster and turret fire.
4. Apply damage, deaths, scrap drops, and pickups.
5. Advance timers: phase/ring transitions and resulting core loss and hazard deaths, disconnect expiry, then due legal respawns. Evaluate contenders once after all transitions.
6. Send each client the state changes it is allowed to see.

The proposed [complete D2 contract](design/D2_HANDOFF.md) fixes boundary tick conventions, simultaneous hits, contender transitions and duration. It remains pending Engineering/QA acceptance under #29; E1 keeps its accepted movement contract. Once accepted, E3/E4 implement these refinements. In particular tick 1800 uses build rules through damage and reveals battle in its send stage; tick 4500 shatters cores before a due respawn. Gameplay freezes immediately on ending.

The step logic is a set of pure functions in `shared/`. The Colyseus room calls them and holds the result.

**Why 15 ticks per second:** on a grid, actions resolve on whole ticks, so a higher rate adds traffic without making the game feel faster. Fifteen keeps the delay between a key press and its result under about 70 milliseconds before network latency.

**Why the client interpolates:** drawing a ship sliding between its last two reported tiles makes movement look smooth, with no prediction code and no corrections when the server disagrees.

## Room lifecycle

| State | Entered when | Leaves when |
|---|---|---|
| `waiting` | The room is created | Quick Play: the countdown ends or 5 players join. Private: the host starts it. |
| `build` | The match starts | 120 s pass or a winner/draw is resolved |
| `battle` | The Belt drops | 300 s pass or a winner/draw is resolved |
| `sudden_death` | 300 s pass | A winner/draw is resolved |
| `ended` | A winner or draw is decided | Proposed D2: 225 ticks after ending, or immediately when empty |

- A room locks when it leaves `waiting`. After that it accepts only reconnecting players and spectators.
- A room in `waiting` with no players is disposed.

## State and visibility

State is defined with Colyseus schemas. The main pieces are match info (phase, clock), players, ships, cores, structures, deposits, and scrap pickups.

Visibility follows one rule per phase:

| Phase | Players receive | Spectators receive |
|---|---|---|
| `waiting` | The public player list | No external admission |
| `build` | Match info and own-sector entities for active/respawning seats; eliminated seats get metadata only | D3 allowlisted match metadata only |
| `battle` and later | Everything | Everything |

This uses Colyseus per-client state views. Each player's view holds their own sector during the build phase, and everything is added to every view when the Belt drops.

**Why filter on the server:** anything sent to a browser can be read in its developer tools. If enemy bases were sent and merely not drawn, hiding them would be cosmetic.

**Why sector-level filtering:** it changes once per match. Per-tick line-of-sight filtering would add work on every tick for every player, and Colyseus advises against leaning on state views for large, fast-changing sets.

## Messages

The original plan specifies five gameplay/start message types; proposed D3 session/host additions are described below.

| Message | Payload | Server checks |
|---|---|---|
| `move` | A direction, or none to stop | The ship is alive and the target tile is passable for this player |
| `fire` | None | The ship is alive and the cooldown has passed |
| `build` | `wall` or `turret` | The ship is alive, the tile is free and within the build radius, and the player can afford it |
| `upgrade` | `blaster` or `hull` | The level is below the maximum and the player can afford it |
| `start` | None | The room is private and waiting, the sender is the host, and at least two participants are present |

Implemented in E1: only `move`, in the local movement prototype, with the exact payload `{ direction: "up" | "down" | "left" | "right" | "none" }`; the server stores one intent per seat and applies the latest validated one. Every other type, including `fire`, `build`, `upgrade` and `start`, is dropped and counted until its phase lands. The server also sends each client one private `welcome` message with its admitted seat and the protocol version.

Anything else, or anything malformed, is dropped.

## Abuse limits

| Limit | Starting value | Why |
|---|---|---|
| Actions per client | 30 per second | The game cannot use more than a few per tick. Excess is dropped, and sustained flooding disconnects the client. Implemented as a fixed one-second window per connection that opens when the connection is accepted; two consecutive windows with more than 60 frames close only that connection, and frames above 1 KiB are refused before parsing. |
| Connections per IP address | 20 | Stops one machine from filling a server. The limit is generous because players on the same campus or home network share one public address. Counted per WebSocket connection on the transport peer address, never a forwarded header. |
| Allowed origins | Exact client origin for the environment; localhost only in local mode | Stops other websites from embedding the game against these servers. It does not stop custom clients, which is why the server validates everything. Checked on matchmaking, preflight and every WebSocket upgrade; a missing or different `Origin` is refused. |
| Rooms per server | `MAX_ROOMS`, starting at 20 | Protects the 512 MB droplet. When the limit is reached, the server reports that it is not accepting players. |
| Nickname | 1 to 16 characters, trimmed, control characters removed | Nicknames are shown to other players, so they are treated as untrusted input. |

Automation cannot be prevented: a script can play legal moves. The tick rate limits how much speed helps, and that is the accepted level of protection for this project.

## Reconnection

- When a connection drops, the server holds the player's seat for 20 seconds.
- The ship stays in the world and can be attacked during that time.
- The client keeps its reconnection token in `sessionStorage` and rejoins the same room automatically.
- If the 20 seconds pass, the ship is removed, and the core stays as a target. Proposed [D2 revision 2](GAME_DESIGN.md#d2-contender-and-win-draw-contract--revision-2) applies one absolute 300-tick deadline across death and respawn, cancels pending respawn at expiry and permanently eliminates the seat. D3/E5 own identity/recovery implementation against the accepted boundary.

**Why the ship stays in the world:** if disconnecting made a ship vanish, pulling the network cable would be a way to dodge a fight.

## The bot

The bot runs inside the room. Each tick it reads the same state a player in its seat would see and queues the same actions a client would send. It goes through the same validation as a human.

**Why it shares the action path:** the bot can never do something a human cannot, and every bot match also exercises the real rules.

## Version compatibility

`shared/` exports a `PROTOCOL_VERSION` number. It increases whenever messages or state change in a way an old client could not handle.

- Each server reports its protocol version, environment, and full build SHA (`protocol`, `environment`, `version`) from `/health`. Protocol 2 replaced the E0 `protocolVersion` and `sha` fields.
- The client ignores any region whose version differs from its own.

**Why:** the client and the servers deploy separately and at slightly different times. Without the check, a player could join a server running different rules and see a broken game.

## What the server does not do

- It does not store anything on disk.
- It does not share state between regions.
- It does not move a match when a server stops. Players in that match return to the start page, where region selection runs again.

## Operational boundaries

Development and production have separate region allowlists and never fail over across environments. Validate configuration at startup. Deployments must coordinate draining, protocol compatibility, client promotion, and rollback as specified in [DEPLOYMENT.md](DEPLOYMENT.md). Test capacity before raising room limits; monitor runtime metrics privately under [OPERATIONS.md](OPERATIONS.md).

## Proposed D3 session and role contract — revision 1

The [complete D3 journeys](design/D3_JOURNEYS.md) under [#33](https://github.com/MyNameIs-Nigel/packetscrapp/issues/33) extend room lifecycle, messages, reconnection and visibility above. They remain proposed pending Engineering/QA acceptance; E1 protocol 2 is unchanged by this documentation. D2 lifecycle revision 2 remains separately proposed.

- Waiting-room disconnect releases the seat immediately. Private host authority transfers to the earliest remaining human; in active play there is no host authority. Proposed inactive-private disposal is five minutes after the last accepted human lobby action/admission.
- Ten external watcher slots include build waiters. Up to five former player connections retain watching separately; maximum admitted human connections is fifteen. Private rooms are unlisted; waiting/ended rooms reject new external watch admission. No role receives tokens or internal identity in public state.
- Eliminated players lose own-sector entity access during build and receive only the D3 metadata allowlist, just like external build watchers. Reveal uses the authoritative tick-1800 state transition. Every server action checks current role, including old player connections.
- Active reconnect credentials bind one seat/room/region/environment, live only in tab sessionStorage, rotate safely and never enter URLs/logs. Acceptance is strictly before `d+300`; death/respawn cannot extend it. A replaced socket loses authority. Voluntary leave acknowledges immediate elimination; an undelivered leave can only take the disconnect-grace path.
- E5 must add validated private waiting host bot add/remove actions, voluntary departure and role-aware join/watch/reconnect operations beyond the five planned gameplay/start messages. Proposed bot control is `bot` with `{ action: "add" | "remove" }`; `start` and `leave` have no payload. Transport admission/reconnect use supported SDK operations, not client assertions of role/seat. Engineering pins exact payloads, refusal codes, frame allowlist, credential issuance/rotation and protocol bump before implementation; unknown messages remain refused under current E1.
- Results cannot be extended by reconnect; replay makes a fresh room/identity. A former player token cannot resurrect an expired player or grant a watcher a second player slot. Expired recovery may offer explicit ordinary Watch admission, with cap rechecked.

**Decision:** specify user-visible role and recovery guarantees before choosing SDK wire details. **Why:** an implementable transport must prove single seat ownership, current-role filtering and exact deadline refusal; a nickname or stale client view cannot establish those facts. Engineering/QA acceptance is a prerequisite, not a claim supplied by this Design proposal. [D3 scenarios J03/J06/J07/J12/J13](design/D3_JOURNEYS.md#observable-acceptance-scenarios) define the negative cases.
