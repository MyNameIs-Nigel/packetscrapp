# Contributing

Thanks for helping build Packet Scrapp. The repository currently contains design documents and repository checks; application commands are specified in [engineering practices](docs/ENGINEERING.md) but are not available yet.

## Workflow

1. Open an issue for a substantial feature, architecture change, or deployment change. Include the problem, acceptance criteria, and how success will be tested.
2. Fork the repository and create a short-lived branch from `main`.
3. Make one focused change. Add a regression test for a bug and update affected documentation with the implementation.
4. Run `python3 scripts/check_docs.py` and `git diff --check`. When application checks exist, run the relevant checks in [ENGINEERING.md](docs/ENGINEERING.md).
5. Open a pull request with the behavior change, verification results, operational impact, and any remaining limitations. Screenshots help for UI changes.
6. Address review feedback and let required checks pass before merging. Maintainers normally squash merge.

Do not commit credentials, generated bundles, local environment files, or player data. Fork pull requests run without deployment secrets. Never test destructive behavior against public servers.

## Definition of done

- Acceptance criteria are met and relevant automated checks pass.
- Failure cases and authorization/input validation are covered.
- Documentation, protocol compatibility, monitoring, and rollback are updated where affected.
- No unexplained new dependency, suppressed check, or unrelated refactor is included.
- UI changes have keyboard and browser verification; deployment changes have development-environment evidence.

Follow the [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue. Contributions are provided under the repository's [MIT License](LICENSE); retain notices and disclose third-party licenses.

Releases are maintainer-owned. Merging deploys to development once application delivery is implemented; production requires a published stable release and its environment gate. See [DEPLOYMENT.md](docs/DEPLOYMENT.md).
