---
name: packet-work
description: Select and deliver one ready Packet Scrapp work package as Design, QA, or Engineering, with a shared phase claim, isolated checkout, evidence, and a pull request. Use to autonomously advance this repository's documented roadmap.
---

# Packet Scrapp: one team, one package, one PR

Run from this repository. With no arguments, discover ready work and choose it yourself. Optional natural-language constraints include `team Design`, `team QA`, `team Engineering`, a phase ID, or an issue URL. Honor supplied constraints; do not ask the user to select a team or task by default.

Invocation authorizes the selected package's issue creation/updates, claim branch, isolated worktree, implementation, tests, commits, push, and PR. Finish those actions without a separate publication confirmation. It does not authorize merge, auto-merge, release, production changes, spending, or changing repository permissions. Respect the host's access controls; never request secrets in chat.

Each invocation is one worker. Choose exactly ONE team and ONE focused package, then stop after its PR handoff. The user can run this skill in several tasks concurrently. Do not spawn a team of agents or take another team's implementation into this run. Required collaboration is a recorded handoff or review request, not permission to self-approve as a second team.

## 1. Establish current truth

Packet Scrapp is a keyboard-first space multiplayer browser game for 2–5 players: harvest scrap, protect a core, and fight after the Belt drops. The planned stack is TypeScript, Canvas 2D/plain DOM, Vite, authoritative Colyseus servers, and in-memory matches. Accounts and persistence are outside the documented scope. Confirm the current implementation rather than assuming the game or deployment is complete.

Find the Git root, read applicable `AGENTS.md`, inspect the working tree and configured remotes, and verify Git/GitHub access. Fetch current upstream `main` without switching, resetting, or stashing the user's checkout. Read the latest-main versions of these documents, not just a potentially stale feature checkout:

| Information | Source relative to repository root |
| --- | --- |
| Overview and doc navigation | `README.md`, `docs/README.md` |
| Actual status, accepted revisions, open gates, next owners | `docs/PROGRESS.md` |
| Dependencies, package record, gate criteria, decision ownership | `docs/DELIVERY_PLAN.md` |
| Contribution and PR requirements | `CONTRIBUTING.md`, `.github/pull_request_template.md` |
| Design entries/exits | `docs/design/README.md` |
| Engineering entries/exits | `docs/engineer/README.md` |
| QA entries/exits and acceptance IDs | `docs/qa/README.md`, `docs/qa/ACCEPTANCE_MATRIX.md` |

Read all three team plans to discover candidates; then read only the selected package's linked handoffs, contracts, and technical docs. Inspect relevant code, current issues, open PRs, merged prerequisite PRs, review records, and remote claim branches. Follow pagination or targeted phase searches so older active work is not missed. Use available GitHub tools or authenticated `gh`; discover the repository from its remote rather than hard-coding an account.

The progress audit is dated evidence, not an eternal backlog. Reconcile it with exact merged commits and review evidence. A merged PR establishes delivered content; it does not establish every required sign-off or runtime result. Resolve material contradictions from source evidence, or treat that dependent package as blocked.

## 2. Find workable work and select one team

Build a short candidate list from phase **Entry**, dependency tables, issue criteria, and existing evidence. Classify each candidate as ready, already owned/in review, completed, or blocked with a concrete missing input. A whole earlier phase need not finish if this slice's prerequisite artifact is accepted.

Choose, in order:

1. A user-specified ready issue/phase/team.
2. An unclaimed Ready package that unblocks the earliest unmet shared gate.
3. A ready independent contract, test-planning, or infrastructure-preparation slice explicitly supported by the docs.

Prefer an existing issue and the smallest package with one observable outcome. Break ties by fewer unavailable dependencies, then earlier phase number, then older issue. Do not redo completed preparation or create busywork merely to produce a PR. A draft contract can be deliverable Design work; it must remain proposed until the required teams accept it. QA preparation can precede implementation; QA execution requires the actual candidate.

Select exactly one owning team and keep it for the run:

| Team | Branch prefix | Work boundary |
| --- | --- | --- |
| Design | `design/` | Rules, contracts, UI specifications, balance and playtest interpretation; update authoritative design docs and examples. Do not implement gameplay to settle a rule. |
| Engineering | `engineer/` | Code, simulation, client/transport, developer tests, tooling and delivery preparation against accepted contracts. Developer tests do not replace independent QA. |
| QA | `qa/` | Independent cases, test tooling, reproducible acceptance evidence and defect reports. Do not fix product behavior or rewrite rules to make a failing test pass; hand the defect to Engineering/Design. |

Before claiming, report team, phase, outcome, accepted prerequisite revisions, acceptance IDs, intended validation, and why the slice is ready. Scope out the rest of the phase explicitly. If the user fixes a blocked team/phase, report its missing input rather than silently switching teams. Otherwise inspect alternatives before concluding no work is ready.

## 3. Claim and isolate

Read [coordination.md](references/coordination.md) and follow it before editing. It uses an atomic remote claim per phase to prevent separate machines or tasks from racing, then a uniquely named team branch/worktree. One active package per phase is deliberately conservative; different phases and teams proceed concurrently.

Only after winning the claim, recheck issues/PRs and reuse or create the package issue using the record in `docs/DELIVERY_PLAN.md`. Record the owner/run ID, claim SHA, phase, scope, accepted prerequisites, acceptance IDs, branch, and next checkpoint. Set the documented status to **In progress**; do not invent missing GitHub labels or assign unknown reviewers.

If claiming fails because another worker owns that phase, try another ready phase of the selected team. If no such package remains, stop with the active work links. Authentication/network failures are not proof of contention or absence of work; stop dependent publication/claim actions and state the exact access blocker.

## 4. Deliver and verify

Work only inside your isolated checkout. Implement the selected outcome and its required tests or evidence. Resolve routine technical choices yourself within accepted contracts. For a missing product decision, access requirement, or cross-team dependency, complete useful independent work inside the package and record the blocker with an owner; do not invent acceptance or broaden into another team's task.

Follow `docs/ENGINEERING.md`, current package scripts, toolchain pins, and CI. Always run `python3 scripts/check_docs.py` and `git diff --check`. For application/tooling changes, run required formatting, lint, types, unit, real SDK integration, build/browser and artifact checks as applicable to the current CI contract. For documentation-only packages, validate links, contracts and examples; report application CI separately. Do not describe skipped checks as passing.

Record full candidate SHA, contract/config revision, seeds where relevant, environment, exact commands/procedures, actual results, and evidence links. UI work needs keyboard/browser evidence; deployed behavior needs development evidence. Mocked or paper results cannot prove live behavior. QA must identify the implementation candidate separately from its test/evidence commit, and must not supply independent approval for implementation it authored.

Keep evidence in a package-specific file under `docs/design/`, `docs/engineer/`, or `docs/qa/` when a durable artifact is warranted. Update relevant acceptance rows and add a concise link/status to `docs/PROGRESS.md` without rewriting other workers' evidence. Use **In review** for a finished package awaiting review. Mark a phase/gate **Verified** only when every required criterion and independent approval is actually present; a PR alone never closes a gate.

## 5. Publish the PR and hand off

Review the diff, commit only this package, and push its team branch. Open one PR against upstream `main`, following `.github/pull_request_template.md` and the delivery plan's package record. Include owning team/phase, issue, outcome, acceptance IDs, accepted prerequisite revisions, candidate SHA, tests/evidence, operational impact, blockers, and next reviewing team. Use closing keywords only when this package fully resolves its issue; a slice of a larger issue merely references it.

Use `--body-file` with `gh` for multiline bodies or structured GitHub tool arguments. Attach the PR to the current task when the host provides `attach_artifact`. A complete deliverable can be ready for review; use a draft when implementation, required validation, or prerequisite acceptance remains blocked. Do not open an empty PR solely to satisfy the workflow.

Inspect CI for the pushed head, fix failures introduced by this package, and rerun affected checks. If CI or external access remains unavailable, leave an honest draft/blocked handoff. Never weaken checks to obtain green CI, claim another SHA's CI as current, merge, or enable auto-merge. Record the PR and **In review** (or **Blocked**) status in the issue. Release the claim only as described in the coordination reference.

End with the team/phase and outcome, PR link, validation result, remaining blockers/review owners, and the next documented handoff. Do not automatically start another package or wait indefinitely for maintainer review.
