"""Exercise remote ownership with disposable Git repositories, never GitHub."""

import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("claim_phase.py")


class ClaimTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = {**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull,
                    "GIT_AUTHOR_NAME": "Claim test", "GIT_AUTHOR_EMAIL": "test@example.invalid",
                    "GIT_COMMITTER_NAME": "Claim test", "GIT_COMMITTER_EMAIL": "test@example.invalid"}
        self.remote = self.root / "remote.git"
        self.run_git(self.root, "init", "--bare", "--initial-branch=main", str(self.remote))
        self.workers = [self.root / "worker-a", self.root / "worker-b"]
        self.run_git(self.root, "clone", str(self.remote), str(self.workers[0]))
        (self.workers[0] / "tracked.txt").write_text("baseline\n")
        self.run_git(self.workers[0], "add", "tracked.txt")
        self.run_git(self.workers[0], "commit", "-m", "initial")
        self.run_git(self.workers[0], "push", "origin", "main")
        self.run_git(self.root, "clone", str(self.remote), str(self.workers[1]))
        self.base = self.run_git(self.workers[0], "rev-parse", "HEAD")

    def run_git(self, cwd, *args):
        return subprocess.run(["git", *args], cwd=cwd, env=self.env, text=True,
                              capture_output=True, check=True).stdout.strip()

    def claim(self, worker, action="acquire", team="engineer", phase="E1", sha=None):
        args = [sys.executable, str(SCRIPT), action, "--team", team, "--phase", phase]
        if action == "acquire":
            args += ["--owner", worker.name, "--summary", "Test package"]
        else:
            args += ["--claim-sha", sha]
        return subprocess.run(args, cwd=worker, env=self.env, text=True, capture_output=True)

    def test_concurrent_claim_and_owner_checked_release(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(self.claim, self.workers))
        self.assertEqual(sorted(result.returncode for result in results), [0, 2])
        receipt = json.loads(next(result.stdout for result in results if result.returncode == 0))
        self.assertEqual(receipt["base_sha"], self.base)
        ref = receipt["ref"]
        self.assertEqual(self.run_git(self.root, "--git-dir", str(self.remote),
                                      "rev-parse", ref), receipt["claim_sha"])
        wrong = self.claim(self.workers[0], action="release", sha=self.base)
        self.assertEqual(wrong.returncode, 2)
        self.assertEqual(self.claim(self.workers[0], action="release",
                                    sha=receipt["claim_sha"]).returncode, 0)
        self.assertEqual(self.claim(self.workers[1]).returncode, 0)
        # A delayed release from the former owner cannot delete the new claim.
        self.assertEqual(self.claim(self.workers[0], action="release",
                                    sha=receipt["claim_sha"]).returncode, 2)

    def test_different_teams_proceed_without_changing_dirty_checkout(self):
        worker = self.workers[0]
        (worker / "tracked.txt").write_text("staged\n")
        self.run_git(worker, "add", "tracked.txt")
        (worker / "tracked.txt").write_text("unstaged\n")
        before = (self.run_git(worker, "diff"), self.run_git(worker, "diff", "--cached"))
        self.assertEqual(self.claim(worker).returncode, 0)
        self.assertEqual(self.claim(self.workers[1], team="design", phase="D2").returncode, 0)
        self.assertEqual(self.run_git(worker, "rev-parse", "HEAD"), self.base)
        self.assertEqual((self.run_git(worker, "diff"),
                          self.run_git(worker, "diff", "--cached")), before)
        self.assertEqual(self.run_git(worker, "for-each-ref", "refs/packet-work/"), "")

    def test_mismatched_team_and_phase_never_claims(self):
        self.assertNotEqual(self.claim(self.workers[0], team="qa", phase="E1").returncode, 0)
        self.assertEqual(self.run_git(self.workers[0], "ls-remote", "origin",
                                      "refs/heads/*/claim-*"), "")


if __name__ == "__main__":
    unittest.main()
