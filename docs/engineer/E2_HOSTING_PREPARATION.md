# E2 development hosting preparation — 2026-10-17

Engineering owner `codex-three-steps-hosting-20261017`, issue #56, branch `engineer/development-hosting-preparation-20261017`. Base `dd6d78fe7a17472d2f5a5cbdb438a5d9053b21c4` (current main with dependency updates). Claim `engineer/claim-e2` at `216f8424c05be95d97328509e9fa383cdb7ff3b5`. Acceptance A11/A12/A14 preparation subset. Inputs are the existing E0 manifest/artifact and E1 health/Origin contract; no hosting decision or credential is invented.

[Deployment preparation](../../deploy/README.md) supplies exact runtime/Caddy/Tunnel/environment/restart-rule files and least-privilege installation, qualification and restore instructions. The Node artifact verifier checks a private immutable staged directory against the expected full SHA, development environment, clean state, pinned toolchain and every declared digest. It rejects undeclared payloads and symlinks/traversal. Tests exercise actual CLI acceptance/failures without invoking a shell or deployment.

This package does not select green main candidates, activate releases, install a builder timer, post deployment statuses or change a host. Those belong to a complete E2 builder/qualification package. No GitHub permissions, production infrastructure, spending or secret binding changes are performed. No externally hosted service or G2 pass is claimed.

Actual local checks and immutable candidate identity are recorded on the PR after commit. Required validation includes docs/whitespace, format/lint/types/unit/SDK/browser checks and real clean development-artifact verification plus bare-bundle smoke. Template target-host validation remains unavailable: the approved host, users, Caddy/cloudflared, DNS/Tunnel bindings and deploy-status credential are not attached. A service template is not an installed service.

Next owners: maintainer supplies approved access/configuration; Engineering implements green-main selection/isolated build/locked atomic activation/restore and development-client endpoint; QA exercises real HTTPS/WSS/failure restore before G2. This is the complete hosting-preparation outcome requested alongside gameplay, with runtime blockers named rather than marked passed.

## Local execution receipt

Code candidate `abe19cd49a2e8f863e085eecbe9c18c32efe4032`, Linux, Node 24.21.0/npm 11.19.0, 2026-10-17 UTC. Fresh pinned install; formatting/lint/types; **221 unit tests** (including seven CLI acceptance/security cases) and **109 real-SDK integration tests** pass. Documentation and whitespace checks pass. `PACKET_BUILD_ENV=development npm run build` emits a clean exact-SHA artifact; `node scripts/verify-development-artifact.mjs dist <full-sha>` passes its three payload digests; `npm run smoke:artifact` passes real health/SDK join and origin/version/configuration refusals from the standalone development bundle. No browser UI changed; required PR CI supplies the browser regression matrix. Later documentation-only head CI is tracked on the PR.

Host-specific systemd/Caddy/cloudflared/sudoers validation and public TLS/WSS were not run: the target software/users/host access are absent. Template review plus a local bundle check cannot establish those runtime results. G2 remains open with the explicit maintainer-access/Engineering-builder/QA-drill handoff above.
