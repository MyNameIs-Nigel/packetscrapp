# Concurrent worker coordination

## Claim protocol

Use the configured writable upstream remote after verifying it is the intended repository. Normal operation requires Python 3.9+, Git identity, authenticated Git fetch/push, and GitHub issue/PR read/write access through a connector or `gh`. Do not change authentication or permission settings automatically. A fork-only contributor cannot safely coordinate through a private fork's claims; report missing upstream claim access.

All participating runs use `refs/heads/<team>/claim-<phase>` as the reservation: for example `engineer/claim-e1`. The bundled helper creates a unique empty commit based on current upstream main, and atomically creates this ref only if absent. It never force-overwrites an existing claim or touches the checkout/index. The claim is not a PR branch and never goes into main.

Before claiming, search current issues and open PRs for the phase, including work made outside this skill. Conservatively skip a phase with active implementation or an open package PR. A QA package may reference an Engineering PR as its candidate; that does not make the QA phase owned. Once claimed, repeat the issue/PR search to close the gap between discovery and acquisition. If a conflicting package appeared, release your claim and reselect within your team.

Run from the repository root, substituting the selected team, phase, remote and a unique task/run identifier:

```sh
python3 .agents/skills/packet-work/scripts/claim_phase.py acquire \
  --remote origin --team engineer --phase E1 \
  --owner '<task-id-or-uuid>' --summary 'One bounded package outcome'
```

Save the JSON receipt, especially `claim_sha`, `base_sha`, and `ref`. Exit 2 means an existing claim; exit 1 means an operational failure. On an uncertain push result the helper reads the remote ref: only an exact match to its unique commit establishes ownership. Do not retry by deleting an existing claim. Inspect the claim commit and linked issue to find its owner; time elapsed alone never makes a claim abandoned. Only the owner releasing it or explicit maintainer authorization permits cleanup of an abandoned claim.

## Worktree and issue

After claiming and rechecking, reuse the matching issue or create one. Use its number in a unique short-lived branch such as `engineer/e1-issue-14-admission-<run-suffix>`. Start from the receipt's current-main `base_sha`, using a separate worktree through Git or the host worktree tool. Never switch the shared user's checkout or copy unrelated dirty files. Do not remove another worker's worktree/branch. Keep ports and generated output isolated too.

The claim serializes selection within a phase, including issue creation, so simultaneous agents do not each create the same backlog issue. Record the claim receipt in the issue along with the work package; an issue assignment/comment by itself is not an atomic lock. A failed issue write leaves the claim owned: recover and retry the write, or release it and report the blocker.

Use the skill from the originating checkout if it is not yet merged into the worktree's base. Existing dirty changes or a different feature branch are not evidence of a ready prerequisite. Do not stack onto an unmerged implementation without explicit user direction and documented candidate acceptance.

## Release and interrupted runs

Keep the claim through implementation and publication. After a PR exists and the issue records its branch/URL and status, release only your own exact claim:

```sh
python3 .agents/skills/packet-work/scripts/claim_phase.py release \
  --remote origin --team engineer --phase E1 --claim-sha '<receipt-claim-sha>'
```

Deletion uses an exact lease so it cannot delete a replacement claim. The open PR now advertises ownership; new workers skip that phase until the PR is merged or closed, then rediscover the remaining ready slice from current evidence.

If stopping before a PR, first record the blocked/abandoned state, branch, preserved work, reason, and next owner in the issue, then release your claim. Do not leave an issue falsely In progress. If that recording fails, preserve the claim and report its ref/SHA for recovery. Never delete a work branch to release a claim.

A resumed invocation may continue its own package after verifying the saved claim SHA, issue, branch, and worktree. If its claim is gone, reacquire and recheck active work before editing. A leftover reservation from a crashed task is a named coordination blocker, not permission to overwrite it. No work is preferable to two agents silently editing the same package.
