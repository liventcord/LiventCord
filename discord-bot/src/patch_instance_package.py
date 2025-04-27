import re
from pathlib import Path


def patch_isinstance_issues(base_dir: Path) -> None:
    pattern = re.compile(
        r'isinstance\(\s*(\w+)\s*,\s*list\[\s*"?(\w+)"?\s*\]\s*\)', re.MULTILINE
    )

    for path in base_dir.rglob("*.py"):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            print(f"⚠️ Skipping unreadable file: {path}")
            continue

        new_text = pattern.sub(
            r"isinstance(\1, list) and all(isinstance(item, \2) for item in \1)", text
        )

        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            print(f"✅ Patched: {path}")
        else:
            print(f"➖ No change: {path}")


patch_isinstance_issues(Path("livent-cord-client"))
