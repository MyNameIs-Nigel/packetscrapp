# Operations runbook

This runbook describes required operations for the planned service. Infrastructure and instrumentation are not implemented yet. The repository maintainer owns release approval, alerts, credentials, and incidents until other owners are assigned.

## Monitoring and capacity

Run an external probe every minute for each environment's client and regional `/health` endpoint. Alert on three consecutive failures, unexpected SHA/protocol/environment, certificate expiry within 14 days, and no region accepting joins for two minutes. A full or draining server is alive but unavailable to new players: alert separately from process failure. Add a periodic synthetic WebSocket join because HTTP success alone does not prove gameplay works. Alert when the Atlanta builder posts a failed `deploy/development` status or has not deployed a green `main` commit within 30 minutes.

Collect private metrics for tick p95/p99, event-loop delay, CPU/RSS, restarts, room/player counts, message rejections, reconnect failures, and deploy duration. Establish capacity from [load tests](ENGINEERING.md); the initial 20-room value is provisional. Keep metrics and system details out of the public health response.

Use structured journald logs with environment, region, full commit SHA, and event name. Bound disk usage and retention (start with seven days), redact tokens and player data, and restrict access. Route alerts to a maintainer-controlled destination and test delivery before launch. Review reliability and capacity after releases; set a service-level objective after collecting a baseline.

## Incident response

1. Record UTC start time, affected environment/regions, symptoms, and deployed SHAs. Check the last deployment and external probes.
2. Stop further promotions. In development, stop the Atlanta builder timer if it would reinstall a broken version. Preserve sanitized logs.
3. If a server is failing, stop it accepting new rooms. In-memory matches cannot migrate and may be lost. Production has one region at launch, so a New York outage means the game is offline until it is restored.
4. Roll back using the deployment procedure below when the last change is implicated. Escalate to a maintenance window when protocols differ.
5. Verify health plus synthetic joins through public routes, communicate recovery, and record duration, impact, cause, and follow-up tests in an issue. Report sensitive incidents privately under [SECURITY.md](../SECURITY.md).

## Rollback and recovery drill

Record the previous client deployment ID, server SHA, and protocol before every rollout. The Atlanta builder records its previous release automatically.

- **Development:** stop the builder timer, atomically restore the previous `current` link, restart the service, and mark the bad SHA as failed. Resume the timer only after the failed SHA is recorded.
- **Production:** under the production deployment lock, atomically restore New York's previous `current` link and restart its service. Promote the previous Vercel client deployment if necessary.

Coordinate client and server for protocol changes; never mix incompatible versions unintentionally. Confirm the full SHA, environment, protocol, acceptance status, and a two-client join. A failed rollback remains an incident; do not mark deployment successful. Perform a development restore drill before the first production release and after changes to deploy tooling.

Match state is ephemeral; there is no database backup to restore. Recovery requires source, immutable release artifacts, server configuration, builder configuration, DNS/Tunnel configuration, and access credentials. Production artifacts are attached to their GitHub Releases. Keep infrastructure/configuration reproducible in version control, secret values in a controlled secret store, and rollback artifacts outside short-lived CI retention. A server restart loses active matches unless draining completes.

## Routine maintenance

- Weekly: review security/dependency updates and failed workflows; patch hosts through development first.
- Before releases: verify capacity, free disk space, previous artifacts, monitoring, protocol plan, and reviewer availability.
- After releases: inspect error/disconnect rates and deployment evidence; retain the previous known-good release.
- On credential exposure or access changes: revoke/rotate affected keys and tokens, verify old credentials fail, and audit access.

Do not run unrelated workloads or self-hosted CI runners on game hosts. The Atlanta host builds development candidates through its pull-based builder, holds no production credentials, and is not production capacity. The New York droplet builds nothing.
