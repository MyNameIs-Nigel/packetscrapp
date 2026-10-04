# Contributing

Thanks for helping build Packet Scrapp. The E0 workspace and connection harness are available; gameplay and deployment remain planned. Use the root application commands in [engineering practices](docs/ENGINEERING.md).

## Workflow

1. Open an issue for a substantial feature, architecture change, or deployment change. Include the problem, acceptance criteria, and how success will be tested.
2. Fork the repository and create a short-lived team branch from current `main`: `design/summary-of-branch`, `engineer/summary-of-branch`, or `qa/summary-of-branch`. Use the owning team's prefix and a lowercase, hyphen-separated summary (for example, `engineer/authoritative-movement`).
3. Make one focused change. Add a regression test for a bug and update affected documentation with the implementation.
4. Run `python3 scripts/check_docs.py` and `git diff --check`. When application checks exist, run the relevant checks in [ENGINEERING.md](docs/ENGINEERING.md).
5. Open a pull request with the behavior change, team/phase ID, acceptance IDs, accepted contract revision, prerequisite issue links, verification results, operational impact, and any remaining limitations. Screenshots help for UI changes.
6. Address review feedback and let required checks pass before merging. Maintainers normally squash merge.

Do not commit credentials, generated bundles, local environment files, or player data. Fork pull requests run without deployment secrets. Never test destructive behavior against public servers.

## Parallel team delivery

Use the [shared delivery plan](docs/DELIVERY_PLAN.md) and the [Design](docs/design/README.md), [Engineering / Programming](docs/engineer/README.md), and [QA](docs/qa/README.md) phase plans. Teams work concurrently against accepted contracts; Design and QA participate before implementation, and QA verifies each usable increment. Keep each issue and PR small enough to have one observable outcome and a measurable checkpoint.

Team branches always use `design/`, `engineer/`, or `qa/`, including tests and documentation. These are naming conventions, not automated enforcement. The overseeing phase-documentation task is explicitly authorized to commit and push on the existing `docs/phases` branch; that task-specific exception does not change the team workflow or authorize merging/releasing.

Engineering supplies developer tests; QA supplies independent acceptance evidence. Design approves intended rule/UI changes. Record evidence against the exact candidate and resolve affected gate failures before declaring a phase verified. For cross-team changes, name one owner and request the other teams' review; avoid long-lived team branches that defer integration.

## Definition of done

- Acceptance criteria are met and relevant automated checks pass.
- Failure cases and authorization/input validation are covered.
- Documentation, protocol compatibility, monitoring, and rollback are updated where affected.
- No unexplained new dependency, suppressed check, or unrelated refactor is included.
- UI changes have keyboard and browser verification; deployment changes have development-environment evidence.
- Applicable [acceptance matrix](docs/qa/ACCEPTANCE_MATRIX.md) rows and shared gates have evidence, with Design/QA review where affected; unresolved blockers have named owners and are not marked passed.

Follow the [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue. Contributions are provided under the repository's [MIT License](LICENSE); retain notices and disclose third-party licenses.

Releases are maintainer-owned. Merging deploys to development once application delivery is implemented; production requires a published stable release and its environment gate. See [DEPLOYMENT.md](docs/DEPLOYMENT.md).
