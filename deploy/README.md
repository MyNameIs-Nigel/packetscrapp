# Development hosting preparation

This is a reviewable **E2 preparation package**, not an installed service or working deployment. It implements no production mutation, automatic rollout or self-hosted GitHub runner. [DEPLOYMENT.md](../docs/DEPLOYMENT.md) remains authoritative. The maintainer supplies approved host/DNS/Tunnel access and budget before actual provisioning. Keep secret values out of source and chat.

## Files and owners

| Artifact | Intended installation / owner |
|---|---|
| [Runtime unit](development/packetscrapp-development.service) | `/etc/systemd/system/packetscrapp-development.service`, root-owned |
| [Runtime environment example](development/development.env.example) | `/etc/packetscrapp/development.env`, root-owned, readable by runtime group; never builder/status credentials |
| [Caddy origin](development/Caddyfile) | Reviewed fragment in root-owned Caddy configuration; serves only loopback `127.0.0.1:8080` |
| [Tunnel routing example](development/cloudflared.yml.example) | Maintainer-approved Tunnel config; credential JSON stays private on host |
| [Narrow restart rule](development/packetscrapp-deploy.sudoers.example) | Root-owned `/etc/sudoers.d/packetscrapp-deploy`, validate with `visudo -cf` |
| [Artifact verifier](../scripts/verify-development-artifact.mjs) | Root-owned trusted tooling, separate from the build user's outputs |

Provision three separate users: `packetscrapp` runtime without login shell, `packetscrapp-build` without token/release access, and `packetscrapp-deploy` owning releases and the narrowly scoped status token. Runtime and Caddy can read releases but cannot modify them. Deploy tooling/configuration are root-owned. Builder gets neither sudo nor deploy/status/production credentials. This repository does not grant user permissions or install these files automatically.

Use `/opt/packetscrapp/runtime/node-v24.21.0/bin/node` for the pinned runtime. Builder additionally needs npm 11.19.0, Git and build dependencies; verify installed versions and digests from trusted distribution sources. New York remains a separate runtime-only host, outside this package. The service's 512 MB limit and 20-room default are provisional safety bounds; measure target-host capacity before release.

## Staged artifact verification

A build must use an exact green main SHA, clean tree, pinned toolchain, `npm ci`, required checks, `PACKET_BUILD_ENV=development npm run build` and standalone smoke. Selecting that green SHA and running untrusted build code under the isolated build user belong to the next pull-builder package; never execute checkout scripts as deploy/root. Copy output to a new deploy-owned staging directory and remove builder write access before verification. It must contain only `manifest.json`, `server/` and `client/` payloads.

```sh
node scripts/verify-development-artifact.mjs /path/to/private/staged-artifact EXPECTED_40_HEX_MAIN_SHA
```

The verifier refuses wrong SHA/environment/dirty state/toolchain, invalid protocol/digests, missing or undeclared files, path traversal and any symlink. It verifies exact bytes; it performs no network, activation or file mutation. A successful result does **not** prove green CI, ancestry, build provenance, safe application behavior, target-host readiness or a deployed service. The calling builder must verify those separately. Private deploy-owned staging is required to prevent concurrent modification between verification and activation; never verify an actively writable build directory or follow `current` as the verifier input.

After verification, a future deploy process can move the immutable staged directory to `/opt/packetscrapp/development/releases/<sha>/`, retaining at least five releases and every rollback target. `current` selects one entire client/server release. Switch it atomically under the deploy lock only after recording the previous target. This package intentionally does not install an incomplete automatic builder or enable a timer.

## Provisioning and qualification sequence

1. Maintainer confirms the Atlanta host, operating-system/runtime sources, spending limit, DNS ownership, Tunnel ID and limited deploy access. Provision isolated users/paths and install the pinned runtime. Verify the runtime and Caddy cannot modify releases or read builder-status credentials.
2. Install/review the service, environment and restart rule; run `systemd-analyze verify` and `visudo -cf` on that host. Confirm the game binds only `127.0.0.1:2567`, the service uses the development artifact/environment and its health reports region `atl`.
3. Validate Caddy with `caddy validate --config ... --adapter caddyfile`. Install Tunnel routes: `dev.packetscr.app` → loopback Caddy, `atl-dev.packetscr.app` → loopback game server, final unmatched route 404. Preserve the browser's exact `Origin`; never configure wildcard CORS or trust arbitrary forwarded IP headers. Current peer limits see the Tunnel peer, so qualify aggregate connections through this topology before broad access.
4. Implement the pull-builder as a separate reviewed slice: newest green current-main selection and ancestry/required-check checks; one lock; no stale downgrade; failed-SHA exclusion; isolated build; immutable staging/digest verification; atomic activation; bounded local/public health and real SDK/WSS probe; automatic restoration of the prior client/server pair on failure; `deploy/development` status written by the deploy identity only.
5. Configure the development client's allowlisted endpoint `https://atl-dev.packetscr.app` in its own reviewed client-delivery slice. Current development bundles contain no configured game endpoint. Do not declare successful browser delivery merely because static HTML loads; the E3 harvest/build preview is local-only until its gameplay rollout is reviewed.
6. On isolated development, prove wrong digests/environments, failed build/restart/health, stale jobs and failed joins never leave a broken activation. Verify HTTPS/WSS externally, no-Origin health, exact-Origin admission and wrong-Origin refusal, client/server SHA/protocol agreement, and a real join. Record full candidate/digests/configuration and restored prior identities. QA supplies independent Q5 evidence before G2.

## Restore checklist for the future activation package

Stop the builder timer before manual restore (no timer is installed by this preparation). Under the same deploy lock, mark the failed SHA excluded, restore the recorded prior `current` target atomically and restart only `packetscrapp-development.service`. Probe startup for at most 60 seconds; require expected SHA/environment/region/protocol, static-client identity and a real SDK/WSS join. Keep the failed release for diagnosis and resume the builder only after successful restoration. Until E7 draining exists, restart terminates active in-memory rooms; use the isolated development environment and show that limitation. Never run these drills against production.

No target host or Tunnel credential is attached to this session. Actual installation, public routing, deploy-status identity, activation/restore drills and G2 remain unverified; the maintainer owns access and Engineering/QA own the subsequent runtime evidence.
