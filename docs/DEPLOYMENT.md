# Deployment

## Overview

One push to `main` deploys everything.

| Part | How it deploys | Trigger |
|---|---|---|
| Client | Vercel builds `client/` and serves it | Vercel's GitHub integration, on push |
| New York server | GitHub Actions copies a bundle over SSH and restarts the service | Workflow, on push to `main` |
| Atlanta server | The node downloads the latest release itself | A timer on the node, every 5 minutes |

## DNS (Cloudflare)

| Name | Points to | Cloudflare proxy |
|---|---|---|
| `packetscr.app` | Vercel, using the records Vercel shows when the domain is added | Off (DNS only) |
| `www` | Vercel, redirecting to the apex | Off (DNS only) |
| `nyc` | The droplet's IP address | Off (DNS only) |
| `atl` | The Cloudflare Tunnel | On (required by the tunnel) |

**Why the proxy is off for Vercel and New York:** Vercel and Caddy each issue their own certificates, and the proxy gets in the way of that. Leaving it off also avoids an extra network hop on game traffic.

**Why it is on for Atlanta:** the tunnel only works through Cloudflare's proxy, and hiding the home IP address is the reason for using a tunnel.

**Why every hostname needs HTTPS:** the whole `.app` top-level domain is HTTPS-only in browsers. A page on `https://packetscr.app` can only open `wss://` connections, never `ws://`.

## Client on Vercel

- The Vercel project's root directory is `client/`, and its output is Vite's `dist/`.
- A rewrite sends `/r/*` to `index.html`, so private room links load the app.
- The client needs no secrets. The region list is part of the bundle.

## New York server (droplet)

### One-time setup

| Step | Why |
|---|---|
| Ubuntu LTS with automatic security updates | Long support window, and patches apply without manual work |
| 1 GB swap file | A safety margin on 512 MB of RAM |
| Firewall allowing only ports 22, 80, and 443 | The game port is reachable only through Caddy |
| SSH with keys only, no passwords, no root login | The SSH port is open to the internet, so the key is the control |
| Node LTS installed from the official packages | The server bundle needs only the Node runtime |
| A `packetscrapp` user with no login shell, which runs the service | A compromised game process has no shell and owns nothing else |
| A `deploy` user that owns `/opt/packetscrapp` | CI can replace files without being root |
| A sudo rule letting `deploy` restart only the game service | CI can restart the game and do nothing else as root |
| Caddy installed from its official packages | Automatic certificates for `nyc.packetscr.app` |

### Caddy

```
nyc.packetscr.app {
    reverse_proxy localhost:2567
}
```

WebSocket connections pass through with no extra configuration.

### Files on the server

```
/opt/packetscrapp/
  releases/<commit>/server.js   One folder per deployed commit
  current -> releases/<commit>  Symlink to the live release
/etc/packetscrapp.env           REGION, MAX_ROOMS, ALLOWED_ORIGINS, PORT
```

**Why a folder per release and a symlink:** switching versions is one atomic step, and rolling back means pointing the symlink at the previous folder.

**Why settings live in an env file on the server:** the same bundle runs in every region. Only the env file differs.

### systemd service

The unit runs `node /opt/packetscrapp/current/server.js` as the `packetscrapp` user with:

- `Restart=always`, so a crash or reboot brings the game back
- `EnvironmentFile=/etc/packetscrapp.env`
- `NoNewPrivileges=true` and `ProtectSystem=strict`, so the process cannot gain privileges or write outside its own directories
- A stop timeout long enough for running matches to finish (see Draining)

## Deploy workflow

The workflow runs on pushes to `main` only, on GitHub-hosted runners.

1. **Check.** Install dependencies, type-check, and run the tests.
2. **Bundle.** esbuild produces a single `server.js` with the commit hash and protocol version built in.
3. **Publish.** Attach `server.js` and its SHA-256 checksum to a GitHub Release tagged with the commit.
4. **Ship to New York.** Copy the bundle to `releases/<commit>/` over SSH, point `current` at it, and restart the service.
5. **Verify.** Request `https://nyc.packetscr.app/health` until `version` matches the new commit.
6. **Roll back on failure.** If the version does not appear within a minute, point `current` back at the previous release, restart, and fail the workflow.

**Why builds happen on GitHub's runners:** a build on the droplet would compete with live matches for 512 MB of RAM.

**Why not a self-hosted runner:** on a public repo, a pull request from a fork could run its own code on the runner, which would be the game server.

**Why only pushes to `main`:** pull requests never run the deploy job, so code from a fork cannot reach the deploy secrets.

**Why verify with `/health`:** a restart that "succeeded" only shows that systemd ran a command. The health check shows that the new version is answering requests.

### Secrets in GitHub

| Secret | Purpose |
|---|---|
| `NYC_HOST` | The droplet's address |
| `NYC_SSH_KEY` | A private key used only for deploys, belonging to the `deploy` user |
| `NYC_HOST_KEY` | The droplet's SSH host key, so the workflow can confirm it is talking to the right machine |

No secret exists for Atlanta.

## Atlanta server (self-hosted)

The container has the same users, folder layout, env file, and systemd service as the droplet, with `REGION=atl`. It runs `cloudflared` in place of Caddy.

### Pull-based updates

A systemd timer runs an update script every 5 minutes. The script:

1. Asks GitHub for the latest release of the repo.
2. Stops if that commit is already live.
3. Downloads `server.js` and its checksum, and verifies the checksum.
4. Places it in `releases/<commit>/`, points `current` at it, and restarts the service.
5. Checks the local `/health` for the new version, and switches back if it does not appear.

**Why pull:** GitHub's runners cannot open an SSH connection into a home network unless SSH is exposed to the internet. With pull, the node makes only outbound requests, and CI holds no credentials for it.

**Why this is safe on a public repo:** only the workflow on `main` can publish a release, and release files on a public repo can be downloaded without a token.

### Open decision: pull for New York too

Using the pull method on both servers would mean one deploy mechanism and no server credentials in GitHub at all. The cost is that New York would update within five minutes of a push, not immediately, and the workflow could no longer verify and roll back the release itself. New York stays on SSH push until this is decided.

## Draining before a restart

Target behaviour, planned for week 4:

1. On a stop signal, the server sets `accepting` to `false` and stops creating rooms.
2. Clients checking `/health` see that and send new players to the other region.
3. The server exits when its last match ends, or after a maximum wait slightly longer than one full match.
4. systemd starts the new version.

**Why:** region failover already exists for outages. Reusing it for restarts means a deploy does not interrupt anyone's match, as long as the two regions do not restart at the same moment. New York restarts on push and Atlanta on its timer, so they are naturally staggered.

Until draining is built, a restart ends the matches in progress on that server. That is acceptable during development.

## Rollback

- **Server:** point `current` at the previous release folder and restart. Keep the last five releases on disk.
- **Client:** promote the previous deployment in Vercel.
- **Protocol changes:** if a release changed `PROTOCOL_VERSION`, roll the client and the servers back together. Otherwise the client will treat every region as unavailable.

## Local development

- One command runs the Vite dev server and a game server on `localhost`.
- In development, the region list contains a single local entry.
- The server's allowed origins include the local dev address in development only.
