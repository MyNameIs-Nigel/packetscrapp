# Deployment and GitHub setup

## Current status

This is the delivery contract for the planned application. `.github/workflows/ci.yml` now checks the E0 application harness and builds client/server artifacts. The workspace produces a digest manifest and a standalone server bundle, but no game, server provisioning, updater, or application deployment workflow exists. GitHub settings alone will not deploy a game; complete the implementation checklist below first.

## Environments and triggers

| Event | GitHub environment | Client | Game servers |
|---|---|---|---|
| Pull request | None | Build/test only | Isolated test processes |
| Push to `main` | `development` | `dev.packetscr.app` | `nyc-dev.packetscr.app`, `atl-dev.packetscr.app` |
| Published stable Release tagged `vMAJOR.MINOR.PATCH` | `production` | `packetscr.app` | `nyc.packetscr.app`, `atl.packetscr.app` |

Hostnames are proposed infrastructure, not verified live services. Use separate Vercel projects, service accounts, SSH keys, service units, release directories, configuration, and ports per environment. Prefer separate hosts/containers; sharing a host also shares its failure and resource limits. Development must never select production regions, and production must never fall back to development.

A tag push alone does **not** deploy production. Publish a non-prerelease GitHub Release for that tag. Drafts and prereleases do not deploy. `main` updates must never move the public site's domain or production server pointer.

## Required application pipelines

These are specifications for future workflows, not installed workflows.

### CI: every pull request and push to main

Use GitHub-hosted runners with read-only repository permission and no environment secrets. Pin actions to verified full commit SHAs. Install the pinned Node/npm toolchain and run `npm ci`, formatting, lint, strict type checks, unit/integration/browser tests, and the client/server builds. The command contract is in [ENGINEERING.md](ENGINEERING.md).

Do not execute fork code through `pull_request_target`, on a game host, or in a privileged follow-up workflow. Cache dependencies, never credentials. Publish sanitized test reports even on failure. Build/test jobs must precede deploy jobs through explicit `needs` dependencies.

### Development: push to main

1. Validate the pushed commit with CI, then build the server and development client from that exact SHA on the runner.
2. Produce immutable artifacts with a manifest containing full commit SHA, protocol version, toolchain versions, environment, and SHA-256 digests. No server-side dependency installation.
3. A job declaring `environment: development` obtains only development credentials. Deploy New York, check its health and a synthetic WebSocket join, then authorize Atlanta to pull that exact artifact.
4. Wait for Atlanta to report the expected version. Deploy the development client and test a room link and two-client match join through its real domain.
5. Record artifact identities, previous versions, verification results, and deployment URLs in the job summary. Fail and roll back affected components when verification fails.

Store development artifacts in a separate development channel (for example a dedicated object-storage bucket with a read-only token on Atlanta). Do not create stable GitHub Releases for every main commit. Only a successful development run should become eligible for production.

### Production: published stable release

Use `release: { types: [published] }`, with an explicit `prerelease == false` condition. Before accessing production secrets:

1. Validate the tag against `^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`. GitHub's `v*` glob is only an outer filter, not SemVer validation.
2. Resolve the tag to a full commit SHA, verify it is reachable from `origin/main`, and verify that exact SHA passed CI and development smoke tests. Check out the resolved SHA, never the latest `main` or `target_commitish` text. Fetch sufficient history for the ancestry check.
3. Reuse the tested immutable server artifact by digest; if retention has expired, rebuild and requalify the commit in development. Build the production client from the same source SHA with the production region allowlist, and test this environment-specific build too.
4. Upload versioned bundles, checksums, and the manifest to that release. Restrict `contents: write` to the publishing job. Never overwrite assets on a retry; verify existing digests or fail.
5. Require the `production` environment gate before any production mutation. Deploy New York, verify it, then publish the approved Atlanta update pointer and wait for Atlanta verification. Only then promote the production client.
6. Mark delivery successful only when both regions and the client report the intended commit/protocol and smoke tests pass. A published Release alone is not evidence of deployment.

Serialize all mutations per environment with a shared concurrency group (including rollback workflows) and `cancel-in-progress: false`. Canceling tests is safe; canceling a deployment halfway through is not. Recheck the selected version before mutation: GitHub concurrency is not a FIFO queue. Reject stale runs that would downgrade a newer successful deployment unless an explicit rollback was selected.

GitHub's `published` event also includes prereleases, which is why the explicit guard matters. See [release events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release) and [action pinning](https://docs.github.com/en/actions/reference/security/secure-use).

## GitHub settings to configure

1. **Settings → Environments:** create `development` and `production`. Select deployment branches/tags: allow only the **branch** `main` for development and only **tags** `v*` for production. Add the corresponding site URLs. Environment rules restrict refs; they do not validate tag syntax or ancestry.
2. For production, require a trusted reviewer and disable administrator bypass where available. Prevent self-review when another maintainer is available. A solo maintainer must either allow self-approval or appoint a second reviewer; do not configure an impossible approval gate.
3. **Settings → Rules → Rulesets:** protect `main` against force pushes and deletion. Require pull requests, resolved discussions, and the `repository-checks` status check after its first successful run. Add application checks once implemented. Require code-owner review when the team can satisfy it. Protect `v*` tags against modification/deletion and restrict creation to release maintainers or a dedicated release identity; avoid broad bypass rights.
4. **Settings → Actions → General:** default workflow token permission to read-only, restrict allowed actions, and require approval for outside contributors as appropriate. Grant write permissions only to the jobs that need them. Never give fork CI production secrets.
5. **Settings → Code security:** enable private vulnerability reporting, Dependabot alerts/security updates, and secret scanning/push protection where available. Actions dependency updates are already configured; add npm updates when the lockfile exists.
6. Populate environment-scoped configuration below only after infrastructure exists. Do not put production credentials in repository-wide secrets.
7. Update the repository About description/topics and use the public website link once the game is actually available. No GitHub settings are changed by this documentation commit.

Reference: [managing GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

### Environment configuration contract

Use the same names with different values in each GitHub environment. These names are reserved for the future workflows.

| Kind | Name | Purpose |
|---|---|---|
| Variable | `CLIENT_URL` | Exact environment website origin |
| Variable | `NYC_HOST`, `NYC_HEALTH_URL`, `ATL_HEALTH_URL` | Environment-specific SSH and health endpoints |
| Variable | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Separate Vercel project per environment |
| Secret | `VERCEL_TOKEN` | Deployment token with the narrowest available scope; document if access spans projects |
| Secret | `NYC_SSH_KEY` | Distinct key for the environment's limited deploy user |
| Secret | `NYC_KNOWN_HOSTS` | Pinned SSH known-hosts entry, verified out of band |
| Variable | `UPDATE_CHANNEL_URL` | Separate approved-update manifest location for each environment |
| Secret | `UPDATE_CHANNEL_WRITE_TOKEN` | Narrow permission to publish artifacts/pointers for that environment only |

Atlanta stores its channel read credential locally if needed; CI does not need inbound SSH access to Atlanta. Never put tokens in the public client, URLs, logs, or artifacts. Rotate credentials on exposure or maintainer departure and verify revocation. Do not obtain trust by running unverified `ssh-keyscan` immediately before deployment.

## Vercel and DNS

Use two projects: one serves `dev.packetscr.app`, the other `packetscr.app` (with `www` redirecting to the apex). Disconnect automatic Git deployments in **both** projects so pushes cannot bypass GitHub checks or approval. CI explicitly targets the environment's project using a pinned Vercel CLI. Each project can use its own Vercel production target (`--prod`); the GitHub environment and project ID determine whether it is the public game.

Once workspaces exist, configure the build from the repository root so the client can resolve `shared/` and the root lockfile. Set the Vite output directory and rewrite `/r/*` to the app entry point. Build with `vercel build --prod`, upload with `vercel deploy --prebuilt --prod --skip-domain`, validate the staged deployment, then promote after the servers pass verification. Retain the previous deployment ID for rollback. See [Vercel CLI deployment](https://vercel.com/docs/cli/deploy).

The client contains public configuration only. Build an explicit environment region allowlist; fail a production build containing development or localhost hosts. If preview protection blocks smoke tests, use its scoped bypass mechanism in CI without exposing that credential to browsers.

| DNS record | Destination | Cloudflare proxy |
|---|---|---|
| Apex, `www`, `dev` | Records supplied by the corresponding Vercel project | DNS only for this design |
| `nyc`, `nyc-dev` | Respective server address | DNS only for direct Caddy TLS |
| `atl`, `atl-dev` | Separate Cloudflare Tunnel routes | Proxied (required for Tunnel) |

The `.app` domain requires HTTPS; public WebSocket connections use `wss://`. Verify DNS, certificates, WebSocket upgrades, and cache behavior in development before production. DNS-only is an architectural choice for the direct hosts, not a claim that Cloudflare proxying cannot work with Vercel or Caddy.

## Server provisioning and rollout

Use patched Ubuntu LTS, a pinned supported Node LTS matching CI, and systemd. Measure memory before choosing instance size; swap is an emergency buffer, not capacity. Allow only SSH and Caddy HTTP/HTTPS on New York; bind the game port to loopback. Use key-only SSH, no root login, and a distinct service user without a login shell.

Each environment has `/opt/packetscrapp/<environment>/releases/<sha>/`, an atomic `current` symlink, `/etc/packetscrapp/<environment>.env`, and its own `packetscrapp-<environment>.service`. The runtime user must not be able to modify release files. The deploy user owns releases and can restart only its exact service through a narrowly scoped sudo rule.

Configuration includes `APP_ENV`, `REGION`, `PORT`, `MAX_ROOMS`, and `ALLOWED_ORIGINS`. Production allows only the production client origin; development allows only the development origin. Localhost is allowed only by local configuration. Verify HTTP CORS and WebSocket Origin independently; neither substitutes for input validation.

Caddy proxies the matching New York hostname to the environment's loopback port. Atlanta uses Cloudflare Tunnel with the same service/configuration layout. systemd should use `Restart=on-failure`, `NoNewPrivileges=true`, `ProtectSystem=strict`, `ProtectHome=true`, a private temporary directory, and explicit resource limits. Provisioning scripts and exact units still need to be written and tested.

### Atlanta's approved-update channel

A timer may poll every five minutes, but must **not** deploy GitHub's generic latest release. Publishing a release happens before production approval and New York verification. Instead, CI publishes a channel pointer only after those gates pass. That pointer identifies environment, tag (production), full SHA, protocol, artifact URL, and digest. Protect writes with environment-specific credentials; authenticate reads over HTTPS and verify the manifest and artifact digest before activation. Checksums alone do not prove publisher identity.

The updater takes a local lock, rejects the wrong environment, downloads to a temporary directory, verifies the artifact, records the previous target, atomically activates, restarts, and probes local health. On failure it restores the previous target and records a failed deployment. Keep known-bad digests from retrying endlessly. CI waits longer than the polling interval plus the drain/startup budget and checks the public endpoint. A timeout is a failed rollout, not eventual success.

### Draining, protocol changes, and rollback

Never rely on two unsynchronized timers to stagger restarts. CI explicitly waits for one region before advancing the other. Before restart, stop new room creation and set `accepting: false`; let existing matches finish within a tested bounded drain timeout. Set systemd's stop timeout above that bound. Probe startup for up to 60 seconds **after** draining, not after the initial stop request. Before draining is implemented, announce that restarts terminate active matches; production launch requires a tested drain path.

During a backward-compatible rollout, the old client must work against both server versions. If `PROTOCOL_VERSION` changes incompatibly, use a maintenance window (or implement parallel protocol pools later). Coordinate both servers and the client; do not promise uninterrupted service when old clients reject new servers. Prompt stale clients to refresh.

On failure, stop promotion and restore the previous approved channel pointer before rolling servers back, so Atlanta's updater cannot reinstall the failed version. Restore the previous client deployment if it was promoted. Verify the old SHA/protocol and a WebSocket join in both regions. Keep at least five server releases plus every active rollback target; do not prune a release still in use. See [OPERATIONS.md](OPERATIONS.md) for incident handling.

## Implementation checklist before the first public release

- [ ] Add npm workspaces, pinned toolchain/lockfile, application commands, and example environment files.
- [ ] Implement environment region allowlists, health/version metadata, WebSocket validation, and bounded draining.
- [ ] Add reproducible client/server builds and test the actual bundle without `node_modules` on the target runtime.
- [ ] Provision isolated services, TLS, update channels, credentials, and external monitoring.
- [ ] Implement CI, development deployment, production release validation/promotion, and approved Atlanta updates as specified above.
- [ ] Prove fork PRs cannot access deployment credentials and main cannot target production.
- [ ] Exercise failed downloads, failed health checks, stale/invalid tags, prereleases, concurrent runs, and coordinated rollback in development.
- [ ] Record a successful two-player development smoke test and restore drill for the exact release candidate.
