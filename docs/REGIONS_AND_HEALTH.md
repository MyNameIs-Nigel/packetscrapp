# Regions and health checks

Design specification; endpoints and infrastructure are not implemented or verified. The table below describes production. Development uses `nyc-dev.packetscr.app` and `atl-dev.packetscr.app` and its own client at `dev.packetscr.app`.

## Summary

There are two game servers. Players are sent to the first healthy one in a fixed priority order, and they can override the choice from a small picker in the bottom-left corner of the start page.

| Priority | Region | Hostname | Host |
|---|---|---|---|
| 1 | New York (`nyc`) | `nyc.packetscr.app` | DigitalOcean droplet |
| 2 | Atlanta (`atl`) | `atl.packetscr.app` | Self-hosted Ubuntu CT container |

## Region selection

### Priority order, not player location

The default region is the first healthy one in the list. A player in Atlanta is still sent to New York while New York is healthy.

**Why:** a small player base split across regions means empty lobbies in every region. Sending everyone to one place fills matches. The cost is a little latency, which a 15-tick grid game hides easily: Atlanta to New York adds a few tens of milliseconds.

### The region list

The planned `shared/regions.ts` exports explicit per-environment allowlists. The production list is shown below; the build selects exactly one environment and rejects cross-environment entries. The order is the priority.

```ts
export const REGIONS = [
  { id: "nyc", label: "New York", host: "nyc.packetscr.app" },
  { id: "atl", label: "Atlanta",  host: "atl.packetscr.app" },
];
```

**Why a file in the repo:** adding or reordering a region is a one-line change that goes through the normal review and deploy. There is no region service to host or secure.

### How the client chooses

1. When the start page loads, the client requests `/health` from every region at the same time, with a 2-second timeout.
2. A region is **available** when the request succeeds, `status` is `ok`, `accepting` is `true`, and both `protocol` and `environment` match the client.
3. In automatic mode, the client uses the first available region in priority order.
4. The client checks again every 30 seconds while the start page is open, and once more when the player presses Quick Play.

Selection happens before a match, never during one.

**Why check again on Quick Play:** the page may have been open for a while. A fresh check stops a player from being sent to a server that went down a minute ago.

### A full server counts as unavailable

When a server reaches its room limit, it reports `accepting: false`. Automatic selection then skips it and uses the next region.

**Why:** the second region exists for failover and for busy periods. Treating "full" like "down" for new players handles both cases with the same rule, and nobody has to notice the load and switch by hand.

### Manual choice

- The picker lists Automatic first, then each region.
- A manual choice is saved in `localStorage` and used on later visits.
- Choosing Automatic clears the saved choice.
- If the saved region is unavailable, the client falls back to automatic selection for that visit and shows a short notice. The saved choice is kept.

**Why fall back:** a player who picked Atlanta weeks ago should still be able to play when Atlanta is offline.

### Room links carry the region

A private room link looks like `https://packetscr.app/r/atl/K7QF`. The client connects to the region named in the link and ignores the player's own setting for that join.

**Why:** a room exists on one server. Without the region in the link, a friend's client could look for the room on the wrong server.

## The region picker

- It sits in the bottom-left corner of the start page as small text, for example `● New York ▾`.
- The dot is green when the region in use is available and red when it is not.
- Clicking it opens a short list. Each row shows the region name, its status, the round-trip time of the last health check, and the number of players online.
- It does not appear during a match.

**Why small and in the corner:** most players should never need it. A prominent picker adds a decision before playing and invites players to spread themselves across regions.

**Why show player counts:** a player who does open the picker is usually asking where the people are.

**Why latency is shown but not used for ordering:** it helps a player make their own choice. The default order stays fixed so that players end up together.

## The health endpoint

Every server answers `GET /health` on the same port as the game.

```json
{
  "status": "ok",
  "region": "nyc",
  "version": "0123456789abcdef0123456789abcdef01234567",
  "environment": "production",
  "protocol": 1,
  "uptimeSeconds": 86400,
  "rooms": 3,
  "players": 11,
  "maxRooms": 20,
  "accepting": true
}
```

| Field | Meaning |
|---|---|
| `status` | `ok` when the server is running normally |
| `region` | The region id from the server's `REGION` setting |
| `version` | The full git commit SHA the server was built from |
| `environment` | `development` or `production` (local mode uses `local`) |
| `protocol` | The server's `PROTOCOL_VERSION` |
| `uptimeSeconds` | Time since the process started |
| `rooms`, `players` | Current counts |
| `maxRooms` | The server's room limit |
| `accepting` | `false` when the server is full or draining for a restart |

Rules for the endpoint:

- It is public and needs no login.
- It sends `Cache-Control: no-store` and allows cross-origin requests only from the configured environment client origin. Validate WebSocket Origin separately.
- It does no heavy work. It reads counters the server already keeps.
- It reports nothing about memory, the operating system, or IP addresses.

**Liveness and readiness differ:** `status: ok` describes a running process; `accepting: true` also requires spare capacity and no active drain. Deployment probes verify HTTP success, status, environment, region, full SHA, and protocol, followed by a synthetic WebSocket join. Public probes use no cache.

**Why keep system details out:** the endpoint is public. Memory and OS details help an attacker and are of no use to players.

### The live match list

`GET /rooms` returns the matches that can be watched on that server: a room id, the phase, and the player count. The start page calls it for the region in use.

**Why a separate endpoint:** `/health` is called often and by everything. Keeping it tiny keeps it cheap.

## Who uses the health check

| Consumer | How | Why |
|---|---|---|
| The client | Before every match and every 30 s on the start page | To pick a region and drive the picker |
| The deploy workflow | After each restart, until `version` matches the new commit | To confirm a release is live, or roll back if it is not |
| An uptime monitor | Every minute, from outside both servers | To alert when a region goes down |
| systemd | `Restart=on-failure` on the service | To restart a crashed process; systemd does not poll `/health` |

**Why an outside monitor as well:** the client's checks protect players, and they tell the developer nothing. Without an alert, a region could be down for days while traffic quietly fails over. Uptime Kuma on the homelab or a free hosted monitor both work, as long as the monitor does not run on the server it is watching.

## What happens when a region goes down

| Situation | Result |
|---|---|
| New York stops between matches | New players go to Atlanta on their next health check. Nothing needs to be changed by hand. |
| New York stops during a match | Matches on it are lost. Those players return to the start page, which then selects Atlanta. |
| New York comes back | New players go to New York again. Matches in progress on Atlanta finish there. |
| New York is full | New Quick Play players go to Atlanta until New York has room. |
| Both are down | The start page says the servers are offline and offers a retry button. |

**Why live matches are not moved:** match state exists only in the memory of one server. Copying it between regions in real time would need shared storage and far more code, to protect a match that lasts five minutes.

## The Atlanta node

The Atlanta server runs the same bundle as New York inside an Ubuntu CT container, with `REGION=atl`.

### Reaching it from the internet

The default is a **Cloudflare Tunnel**: a small `cloudflared` service in the container makes an outbound connection to Cloudflare, and `atl.packetscr.app` routes through it to the game server's local port.

**Why a tunnel:**

- No ports are forwarded on the home router.
- The home IP address stays out of public DNS.
- It works even if the home connection has no public address of its own.
- Cloudflare terminates TLS, so this node does not need Caddy.

The alternative is forwarding ports 80 and 443 to the container and running Caddy there, as on the droplet. That exposes the home address to anyone who looks up the hostname.

One thing to verify: Cloudflare may close a proxied connection that stays idle for long. A match sends state many times a second, so game connections stay active. Lobby connections should send a periodic ping.

### Limits of a home-hosted region

- Home upload bandwidth and power are less reliable than a data center. That is acceptable for a second-priority region.
- If it later becomes the busier region, moving it to a rented server is a DNS change and an environment setting.

## Adding a region later

1. Bring up a server with the standard setup and a new `REGION` value.
2. Add a DNS record for its hostname.
3. Add one line to `shared/regions.ts` at the right priority.
4. Test capacity, monitoring, failover, and deployment in development, then release to production.
