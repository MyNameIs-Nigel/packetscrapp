#!/usr/bin/env python3
"""Atomically reserve a Packet Scrapp phase; no checkout/index mutations."""

import argparse
import json
import re
import subprocess
import sys
import uuid


def git(*args, input_text=None):
    return subprocess.run(
        ["git", *args], input=input_text, text=True, capture_output=True, check=True
    ).stdout.strip()


def remote_sha(remote, ref):
    output = git("ls-remote", "--refs", remote, ref)
    return output.split()[0] if output else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("acquire", "release"))
    parser.add_argument("--remote", default="origin")
    parser.add_argument("--team", required=True, choices=("design", "engineer", "qa"))
    parser.add_argument("--phase", required=True)
    parser.add_argument("--owner")
    parser.add_argument("--summary")
    parser.add_argument("--claim-sha")
    args = parser.parse_args()
    phase = args.phase.lower()
    patterns = {"design": r"d[0-5]", "engineer": r"e[0-7]", "qa": r"q[0-6]"}
    if not re.fullmatch(patterns[args.team], phase):
        parser.error("phase must belong to the selected team's documented roadmap")
    if args.remote.startswith("-") or args.remote not in git("remote").splitlines():
        parser.error("remote must name a configured repository remote")
    ref = f"refs/heads/{args.team}/claim-{phase}"
    if args.action == "release":
        if not args.claim_sha or not re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", args.claim_sha):
            parser.error("release requires the full claim SHA from your receipt")
        current = remote_sha(args.remote, ref)
        if current is None:
            print(json.dumps({"status": "already-absent", "ref": ref}))
            return 0
        if current != args.claim_sha:
            print(json.dumps({"status": "not-owner", "ref": ref}), file=sys.stderr)
            return 2
        git("push", f"--force-with-lease={ref}:{args.claim_sha}", args.remote, f":{ref}")
        print(json.dumps({"status": "released", "ref": ref}))
        return 0

    if not args.owner or not args.summary:
        parser.error("acquire requires --owner and --summary")
    current = remote_sha(args.remote, ref)
    if current:
        print(json.dumps({"status": "busy", "ref": ref, "claim_sha": current}))
        return 2
    # Worktrees share FETCH_HEAD. Use a private ref so another fetch cannot change our base.
    base_ref = f"refs/packet-work/{uuid.uuid4()}/base"
    try:
        git("fetch", "--no-tags", "--no-write-fetch-head", args.remote,
            f"refs/heads/main:{base_ref}")
        base = git("rev-parse", f"{base_ref}^{{commit}}")
    finally:
        git("update-ref", "-d", base_ref)
    tree = git("rev-parse", f"{base}^{{tree}}")
    metadata = {"team": args.team, "phase": phase.upper(), "owner": args.owner,
                "summary": args.summary, "run_nonce": str(uuid.uuid4()), "base_sha": base}
    claim = git("commit-tree", tree, "-p", base,
                input_text=f"Reserve {phase.upper()} for packet-work\n\n{json.dumps(metadata)}\n")
    receipt = {"status": "acquired", "remote": args.remote, "ref": ref,
               "claim_sha": claim, **metadata}
    try:
        git("push", f"--force-with-lease={ref}:", args.remote, f"{claim}:{ref}")
    except subprocess.CalledProcessError:
        # A lost response may follow a successful remote mutation. Verify ownership.
        current = remote_sha(args.remote, ref)
        if current != claim:
            if current:
                print(json.dumps({"status": "busy", "ref": ref, "claim_sha": current}))
                return 2
            raise
    print(json.dumps(receipt))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except subprocess.CalledProcessError as error:
        print(error.stderr.strip() or "Git operation failed; inspect remote state before retrying.",
              file=sys.stderr)
        sys.exit(1)
