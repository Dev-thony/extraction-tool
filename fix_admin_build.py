
from pathlib import Path
import json
import shutil
from datetime import datetime
import sys

ROOT = Path.cwd().resolve()

required = [
    ROOT / "package.json",
    ROOT / "packages/core/package.json",
    ROOT / "packages/core/src/index.ts",
    ROOT / "packages/core/src/utils/name-format.ts",
]

missing = [str(p) for p in required if not p.is_file()]
if missing:
    sys.exit(
        "Run this script from the project root. Missing files:\n"
        + "\n".join(missing)
    )

core_package = ROOT / "packages/core/package.json"
core_index = ROOT / "packages/core/src/index.ts"

# Identify all files that import the formatter from the unsafe root barrel.
targets = []
for base in [ROOT / "apps/admin", ROOT / "apps/extractor"]:
    if not base.exists():
        continue
    for path in base.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        if "node_modules" in path.parts or ".next" in path.parts:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            continue
        if (
            "toTitleCaseName" in content
            and "from '@extraction/core'" in content
        ):
            targets.append(path)

backup = ROOT / ".build-fix-backups" / datetime.now().strftime(
    "%Y%m%d-%H%M%S"
)
backup.mkdir(parents=True, exist_ok=False)

files_to_backup = [core_package, core_index, *targets]
for path in set(files_to_backup):
    destination = backup / path.relative_to(ROOT)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)

changed = []

try:
    # Add a dedicated package subpath for the browser-safe utility.
    data = json.loads(core_package.read_text(encoding="utf-8"))
    exports = data.get("exports")

    if not isinstance(exports, dict):
        raise ValueError(
            "Expected packages/core/package.json exports to be an object."
        )

    expected_target = "./src/utils/name-format.ts"
    existing = exports.get("./name-format")
    if existing not in (None, expected_target):
        raise ValueError(
            f"Unexpected existing ./name-format export: {existing}"
        )

    if existing is None:
        exports["./name-format"] = expected_target
        core_package.write_text(
            json.dumps(data, indent=2) + "\n",
            encoding="utf-8",
        )
        changed.append(str(core_package.relative_to(ROOT)))

    # Do not export browser utility through the server-only root barrel.
    index_text = core_index.read_text(encoding="utf-8")
    updated_index = index_text.replace(
        "export * from './utils/name-format';\n", ""
    ).replace(
        "export * from './utils/name-format';", ""
    )

    if updated_index != index_text:
        core_index.write_text(updated_index, encoding="utf-8")
        changed.append(str(core_index.relative_to(ROOT)))

    # Directly import only the browser-safe formatter subpath.
    for path in targets:
        original = path.read_text(encoding="utf-8")
        updated = original.replace(
            "from '@extraction/core'",
            "from '@extraction/core/name-format'",
        )
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed.append(str(path.relative_to(ROOT)))

    if not targets:
        print(
            "WARNING: No formatter imports from @extraction/core were found. "
            "Inspect the changed files manually."
        )

    print("\nAdmin build import-boundary fix applied.")
    print("Backup:", backup)
    print("Changed files:")
    for item in changed:
        print(" -", item)

    print("\nNext run:")
    print("  npm run typecheck --workspaces --if-present")
    print("  npm run build")

except Exception as error:
    print("Fix failed:", error)
    print("Restoring backed-up files...")
    for path in set(files_to_backup):
        saved = backup / path.relative_to(ROOT)
        if saved.exists():
            shutil.copy2(saved, path)
    sys.exit(1)
