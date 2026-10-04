#!/usr/bin/env python3
"""Check repository docs without network access or third-party dependencies.

Checks relative inline-link file targets and whitespace, not URL reachability,
Markdown anchors, reference-style links, or full Markdown syntax.
"""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "README.md", "LICENSE", "CONTRIBUTING.md", "SECURITY.md",
    "CODE_OF_CONDUCT.md", "docs/DEPLOYMENT.md", "docs/ENGINEERING.md",
    "docs/OPERATIONS.md",
)


def check(root: Path) -> list[str]:
    errors = []
    for name in REQUIRED:
        if not (root / name).is_file():
            errors.append(f"missing required file: {name}")
    paths = list(root.glob("*.md"))
    for directory in ("docs", ".github", ".agents/skills"):
        paths.extend((root / directory).rglob("*.md"))
    for path in sorted(paths):
        relative = path.relative_to(root)
        text = path.read_text(encoding="utf-8")
        if not text.endswith("\n"):
            errors.append(f"{relative}: missing final newline")
        fenced = False
        for number, line in enumerate(text.splitlines(), 1):
            if line != line.rstrip():
                errors.append(f"{relative}:{number}: trailing whitespace")
            if line.lstrip().startswith(("```", "~~~")):
                fenced = not fenced
                continue
            if fenced:
                continue
            for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", line):
                parts = urlsplit(target.strip("<>"))
                if parts.scheme or parts.netloc or not parts.path:
                    continue
                resolved = (path.parent / unquote(parts.path)).resolve()
                if not resolved.is_relative_to(root.resolve()):
                    errors.append(f"{relative}:{number}: link outside repository: {target}")
                elif not resolved.exists():
                    errors.append(f"{relative}:{number}: missing link target: {target}")
    return errors


if __name__ == "__main__":
    errors = check(ROOT)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)
    print("Repository documentation checks passed.")
