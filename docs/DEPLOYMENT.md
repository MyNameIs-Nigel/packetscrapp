# Deployment and GitHub setup

## Current status

This is the delivery contract for the planned application. `.github/workflows/ci.yml` checks the E0 application harness and builds client/server artifacts. The workspace produces a digest manifest and a standalone server bundle, but no game, server provisioning, development builder, or production deployment workflow exists. GitHub settings alone will not deploy a game; complete the implementation checklist below first.

## Environments and triggers

| Event | Environment | Built by | Client | Game server |
|---|---|---|---|---|
| Pull request | None | GitHub-hosted runner (build/test only) | None | Isolated test processes |
| Push to `main` | `development` | The Atlanta development host, after CI passes | `dev.packetscr.app` on the Atlanta host | `atl-dev.packetscr.app` on the Atlanta host |
| Published stable Release tagged `vMAJOR.MINOR.PATCH` | `production` | GitHub-hosted runner | `packetscr.app` on Vercel | `nyc.packetscr.app` on the New York droplet |

Hostnames are proposed infrastructure, not verified live services.

**Development is the whole application on one self-hosted machine.** The Atlanta host (a self-hosted Ubuntu CT container) serves the development client and runs the development game server. It builds each green `main` commit itself and deploys it in place.

**Production is split.** Vercel serves the static client. The New York droplet (1 vCPU, 512 MB) runs only the server bundle; it never builds, installs packages, or holds source code.

**Why build development on Atlanta:** it has spare compute, no per-minute cost, and no inbound access from the internet. Pulling and building there needs no artifact store, no inbound SSH, and no deployment credential in GitHub.

**Why build production on a GitHub-hosted runner:** production credentials (the New York SSH key and the Vercel token) must never sit on the development host. Hosted runners are ephemeral, isolated from fork code, and have enough compute; the droplet does not.

The two environments use separate hosts, service users, configuration, ports, and credentials. Development must never select production regions, and production must never fall back to development. A tag push alone does **not** deploy production: publish a non-prerelease GitHub Release for that tag. Drafts and prereleases do not deploy.

## Pipelines

### CI: every pull request and push to main

Use GitHub-hosted runners with read-only repository permission and no environment secrets. Pin actions to verified full commit SHAs. Install the pinned Node/npm toolchain and run `npm ci`, formatting, lint, strict type checks, unit/integration/browser tests, and the client/server builds. The command contract is in [ENGINEERING.md](ENGINEERING.md).

Do not execute fork code through `pull_request_target`, on a game host, or in a privileged follow-up workflow. Cache dependencies, never credentials. Publish sanitized test reports even on failure. On `main`, the `repository-checks` and `application-checks` results are the gate the Atlanta builder waits for.

### Development: push to main, built on Atlanta

The Atlanta host runs a pull-based **development builder**: a systemd timer that checks GitHub every two minutes. It needs no inbound connection, and GitHub never connects to it.

1. **Select a candidate.** Read the current `main` SHA from the GitHub API. Wait until `repository-checks` and `application-checks` on that exact SHA have concluded `success`. Skip SHAs that are already deployed or recorded as failed. Always take the newest green SHA; never move backwards unless an operator runs an explicit rollback.
2. **Build.** Take a host-wide lock. Fetch that exact SHA into a clean working directory and verify it is reachable from `origin/main`. As an unprivileged build user with no access to tokens or release directories, run `npm ci`, `PACKET_BUILD_ENV=development npm run build` (with the development region allowlist), and `npm run smoke:artifact`. The build requires the pinned Node and npm versions and a clean checkout.
3. **Activate.** As the deploy user, copy `dist/server/server.mjs`, `dist/client/`, and `dist/manifest.json` into `/opt/packetscrapp/development/releases/<sha>/`, then verify the copied files against the manifest digests. Record the previous target, atomically switch `current`, and restart `packetscrapp-development.service`.
4. **Verify.** Within 60 seconds, local `/health` must report the expected SHA, `development` environment, `atl` region, and protocol. Then check the public routes `https://atl-dev.packetscr.app/health` and `https://dev.packetscr.app` and run a synthetic WebSocket join.
5. **Report or restore.** On success, post the commit status `deploy/development` = `success` on that SHA. On any failure, restore the previous `current`, restart, verify it, record the SHA as failed so it is not retried, and post `deploy/development` = `failure`. Log every result to journald with the SHA.

The `deploy/development` status is the evidence production requires. Its token is a fine-grained personal access token limited to this repository with **Commit statuses: read and write** only. It is readable only by the deploy user.

**Why not a self-hosted GitHub Actions runner:** the repository is public and owned by a personal account, so runner groups cannot restrict which workflows use the runner. A fork's pull request could edit a workflow to run code on the home network. The pull model only ever builds commits already on protected `main`.

**Accepted risk:** `npm ci` and the build run code from `main` and its locked dependencies on the Atlanta host. Branch protection, review, and the lockfile limit what reaches `main`. The unprivileged build user, systemd sandboxing, and the absence of production credentials limit the damage.

### Production: published stable release, built on GitHub

Use `release: { types: [published] }`, with an explicit `prerelease == false` condition. Before accessing production secrets:

1. Validate the tag against `^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`. GitHub's `v*` glob is only an outer filter, not SemVer validation.
2. Resolve the tag to a full commit SHA, verify it is reachable from `origin/main`, and verify that exact SHA has successful CI and a successful `deploy/development` status. Check out the resolved SHA, never the latest `main` or `target_commitish` text. Fetch enough history for the ancestry check. Because the builder skips intermediate commits, tag a SHA that development actually deployed.
3. In a job without secrets, run `npm ci`, the full checks, `PACKET_BUILD_ENV=production npm run build` with the production region allowlist, and `npm run smoke:artifact`. The server bundle embeds its environment, so the development bundle cannot be reused; both are built from the same SHA and toolchain.
4. Upload the server bundle, the client archive, and the manifest to the release. Restrict `contents: write` to that publishing job. Never overwrite assets on a retry; verify existing digests or fail.
5. Require the `production` environment approval before any production mutation. Then deploy to New York:
   - Copy `server.mjs` and `manifest.json` over SSH to `/opt/packetscrapp/production/releases/<sha>/` and verify the digest on the host.
   - Atomically switch `current` and restart `packetscrapp-production.service`.
   - Verify `https://nyc.packetscr.app/health` reports the expected SHA, environment, region, and protocol, and run a synthetic WebSocket join. On failure, restore the previous target and stop.
6. Only after New York passes, deploy the client to Vercel: `vercel build --prod`, then `vercel deploy --prebuilt --prod --skip-domain`. Validate the staged deployment, then promote it. Keep the previous deployment ID for rollback.
7. Mark delivery successful only when New York and the client report the intended commit and protocol and smoke tests pass. A published Release alone is not evidence of deployment.

Serialize production mutations, including rollbacks, with one concurrency group and `cancel-in-progress: false`. Canceling tests is safe; canceling a deployment halfway through is not. Recheck the selected version before mutation: GitHub concurrency is not a FIFO queue. Reject a stale run that would downgrade a newer successful deployment unless an explicit rollback was selected.

GitHub's `published` event also includes prereleases, which is why the explicit guard matters. See [release events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release) and [action pinning](https://docs.github.com/en/actions/reference/security/secure-use).

## GitHub settings to configure

1. **Settings → Environments:** create `production`. Allow only **tags** `v*` as deployment refs and add the site URL. Environment rules restrict refs; they do not validate tag syntax or ancestry. No `development` GitHub environment is needed, because no workflow deploys to development.
2. For production, require a trusted reviewer and disable administrator bypass where available. Prevent self-review when another maintainer is available. A solo maintainer must either allow self-approval or appoint a second reviewer; do not configure an impossible approval gate.
3. **Settings → Rules → Rulesets:** protect `main` against force pushes and deletion. Require pull requests, resolved discussions, and the `repository-checks` and `application-checks` status checks. The Atlanta builder trusts that only reviewed, checked commits reach `main`. Require code-owner review when the team can satisfy it. Protect `v*` tags against modification and deletion, and restrict creation to release maintainers or a dedicated release identity. Avoid broad bypass rights.
4. **Settings → Actions → General:** default workflow token permission to read-only, restrict allowed actions, and require approval for outside contributors as appropriate. Grant write permissions only to the jobs that need them. Never give fork CI production secrets. Do not register a self-hosted runner.
5. **Settings → Code security:** enable private vulnerability reporting, Dependabot alerts/security updates, and secret scanning/push protection where available.
6. **Personal access token for Atlanta:** create a fine-grained token for this repository only, with **Commit statuses: read and write**, and an expiry date. Store it on the Atlanta host, not in GitHub. Public metadata needs no other permission.
7. Populate production configuration below only after infrastructure exists. Do not put production credentials in repository-wide secrets.

Reference: [managing GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

### Configuration contract

Production values live in the `production` GitHub environment. These names are reserved for the future release workflow.

| Kind | Name | Purpose |
|---|---|---|
| Variable | `CLIENT_URL` | Exact production website origin |
| Variable | `NYC_HOST`, `NYC_HEALTH_URL` | New York SSH target and public health endpoint |
| Variable | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | The production Vercel project |
| Secret | `VERCEL_TOKEN` | Deployment token with the narrowest available scope |
| Secret | `NYC_SSH_KEY` | Key for the droplet's limited deploy user |
| Secret | `NYC_KNOWN_HOSTS` | Pinned SSH known-hosts entry, verified out of band |

Development values live only on the Atlanta host:

| File | Contents |
|---|---|
| `/etc/packetscrapp/development.env` | Game server runtime configuration |
| `/etc/packetscrapp/builder.env` | Repository, branch, required check names, local and public health URLs |
| `/etc/packetscrapp/builder-status-token` | The commit-status token; mode `0400`, owned by the deploy user |

Never put tokens in the public client, URLs, logs, or artifacts. Rotate credentials on exposure or maintainer departure and verify revocation. Do not obtain trust by running unverified `ssh-keyscan` immediately before deployment.

## Vercel and DNS

Vercel serves production only. Use one project for `packetscr.app`, with `www` redirecting to the apex. Disconnect automatic Git deployments so pushes cannot bypass GitHub checks or approval. The release workflow targets the project with a pinned Vercel CLI.

Configure the build from the repository root so the client can resolve `shared/` and the root lockfile. Set the Vite output directory and rewrite `/r/*` to the app entry point. See [Vercel CLI deployment](https://vercel.com/docs/cli/deploy).

The client contains public configuration only. Each build gets an explicit region allowlist: production lists only `nyc.packetscr.app`, and development lists only `atl-dev.packetscr.app`. A production build containing development or localhost hosts must fail.

| DNS record | Destination | Cloudflare proxy |
|---|---|---|
| Apex, `www` | Records supplied by the Vercel project | DNS only for this design |
| `nyc` | New York droplet address | DNS only, for direct Caddy TLS |
| `dev`, `atl-dev` | Cloudflare Tunnel routes on the Atlanta host | Proxied (required for Tunnel) |

The `.app` domain requires HTTPS; public WebSocket connections use `wss://`. Verify DNS, certificates, WebSocket upgrades, and cache behavior in development before production.

## Hosts

Both hosts use patched Ubuntu LTS, the pinned Node version that CI uses, systemd, key-only SSH, no root login, and a distinct service user without a login shell. The runtime user must not be able to modify release files. The game port binds to loopback only.

Each environment has `/opt/packetscrapp/<environment>/releases/<sha>/`, an atomic `current` symlink, `/etc/packetscrapp/<environment>.env`, and its own `packetscrapp-<environment>.service`. The deploy user owns releases and can restart only its exact service through a narrowly scoped sudo rule. Keep at least five releases plus every rollback target.

The server currently reads `PACKET_ENV`, `PACKET_REGION`, `PACKET_HOST`, and `PACKET_PORT`. Room limits and allowed origins are planned settings. Production allows only the production client origin, and development allows only `https://dev.packetscr.app`. Localhost is allowed only by local configuration. Verify HTTP CORS and WebSocket Origin independently; neither replaces input validation.

systemd units use `Restart=on-failure`, `NoNewPrivileges=true`, `ProtectSystem=strict`, `ProtectHome=true`, a private temporary directory, and explicit resource limits. Provisioning scripts and exact units still need to be written and tested under `deploy/`.

### Atlanta development host

- **Packages:** Node and npm at the pinned versions, `git`, Caddy, and `cloudflared`.
- **Users:** `packetscrapp` (runtime), `packetscrapp-build` (no token or release access), and `packetscrapp-deploy` (owns releases, holds the status token).
- **Services:**
  - `packetscrapp-development.service` runs the game server on `127.0.0.1` with `PACKET_ENV=development` and `PACKET_REGION=atl`.
  - Caddy serves `current/client/` on loopback and rewrites `/r/*` to `index.html`.
  - `packetscrapp-dev-builder.timer` runs the builder.
- **Tunnel:** Cloudflare Tunnel routes `dev.packetscr.app` to Caddy and `atl-dev.packetscr.app` to the game port. Cloudflare terminates TLS.

### New York production droplet

- **Packages:** the Node runtime binary at the pinned version and Caddy. Do not install npm, git, or build tools.
- **Network:** allow only SSH and Caddy HTTP/HTTPS. Caddy proxies `nyc.packetscr.app` to the loopback game port.
- **Memory:** cap the process with a V8 heap limit and systemd `MemoryMax`. Measure memory before raising room limits; swap is an emergency buffer, not capacity.

## Draining, protocol changes, and rollback

Before restart, stop new room creation and set `accepting: false`; let existing matches finish within a tested bounded drain timeout. Set systemd's stop timeout above that bound. Probe startup for up to 60 seconds **after** draining. Before draining is implemented, restarts terminate active matches; production launch requires a tested drain path.

Development replaces client and server together on one host, so a protocol change takes effect there at once. In production, the server updates before the client. During a backward-compatible change, the old client must work against the new server. If `PROTOCOL_VERSION` changes incompatibly, use a maintenance window and prompt stale clients to refresh.

**Development rollback:** stop the builder timer, switch `current` to the previous release, restart, and verify. Mark the bad SHA as failed so the builder does not reinstall it, then resume the timer.

**Production rollback:** under the production concurrency group, switch New York's `current` to the previous release and restart. Promote the previous Vercel deployment if the client was promoted. Verify SHA, protocol, and a WebSocket join. See [OPERATIONS.md](OPERATIONS.md) for incident handling.

## Implementation checklist before the first public release

- [x] Add npm workspaces, pinned toolchain/lockfile, application commands, and a reproducible bundle.
- [ ] Implement environment region allowlists, health/version metadata, WebSocket validation, and bounded draining.
- [ ] Add `deploy/` with systemd units, the Caddy configuration, example environment files, and the Atlanta development builder.
- [ ] Provision the Atlanta host and Tunnel, the New York droplet, TLS, credentials, and external monitoring.
- [ ] Prove a green `main` commit reaches `dev.packetscr.app` and `atl-dev.packetscr.app` and that a failed build or health check restores the previous release.
- [ ] Implement the production release workflow, including tag validation, the development-status gate, New York deployment, and Vercel promotion.
- [ ] Prove fork PRs cannot access deployment credentials or the Atlanta host, and `main` cannot target production.
- [ ] Exercise failed builds, failed health checks, stale/invalid tags, prereleases, concurrent runs, and rollback in both environments.
- [ ] Record a successful two-player development smoke test and restore drill for the exact release candidate.
