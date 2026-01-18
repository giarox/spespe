from pathlib import Path
import re

DISALLOWED = ["scraper", "scrape"]
ALLOWED_FILE_EXTENSIONS = {".py", ".md", ".yml"}
EXCLUDE_PATHS = {
    "node_modules",
    ".git",
    ".next",
    "web/node_modules",
    "web/.next",
    "web/.vercel",
    "web/public",
    "data",
    "tests/__pycache__",
}


def should_scan(path: Path) -> bool:
    if any(part in EXCLUDE_PATHS for part in path.parts):
        return False
    if path.suffix not in ALLOWED_FILE_EXTENSIONS:
        return False
    return True


def test_no_disallowed_terms_in_repo() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    offenders = []

    for path in repo_root.rglob("*"):
        if not path.is_file() or not should_scan(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for term in DISALLOWED:
            if re.search(rf"\b{term}\b", text, re.IGNORECASE):
                offenders.append(path.relative_to(repo_root))
                break

    assert not offenders, f"Found disallowed naming in: {sorted(set(offenders))}"
