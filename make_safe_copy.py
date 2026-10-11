#!/usr/bin/env python3

import os
import re
import sys
import shutil
from pathlib import Path
from datetime import datetime

# Run this script from the root of your project.
SOURCE = Path.cwd().resolve()

# Never copy common secret files or private local configuration.
EXCLUDED_NAMES = {
    ".env", ".env.local", ".env.development",
    ".env.production", ".env.test", ".env.staging",
    ".env.development.local", ".env.production.local",
    ".env.test.local", ".env.staging.local",
    ".npmrc", ".pypirc", ".netrc",
    ".git-credentials", "credentials.json",
    "service-account.json", "serviceAccountKey.json",
    "firebase-adminsdk.json",
    "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa",
    "known_hosts", "authorized_keys",
    "secrets.json", "secrets.yaml", "secrets.yml",
    "secrets.toml", "secrets.txt",
    "terraform.tfstate", "terraform.tfstate.backup",
    ".DS_Store",
}

EXCLUDED_DIRS = {
    ".git", ".svn", ".hg",
    "node_modules", ".next", ".nuxt",
    ".vercel", ".netlify", ".turbo",
    ".cache", ".pytest_cache", "__pycache__",
    ".venv", "venv", "virtualenv",
    "dist", "build", "coverage",
    ".idea", ".vscode",
    ".ssh", ".aws", ".azure", ".gnupg",
    ".supabase", ".wrangler",
}

# Private keys, certificates, signing keys and database backups.
EXCLUDED_SUFFIXES = {
    ".pem", ".key", ".p12", ".pfx", ".jks",
    ".keystore", ".mobileprovision",
    ".ppk", ".der", ".crt", ".cer",
    ".sql.gz", ".dump", ".bak",
    ".tfstate",
}

EXCLUDED_FILENAMES_CONTAINING = (
    "service-account",
    "service_account",
    "private-key",
    "private_key",
    "credentials",
    "secret",
    "secrets",
)

# High-confidence secret patterns in file contents.
SECRET_PATTERNS = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{30,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    re.compile(r"\b(?:sb_secret_|sb_publishable_)[A-Za-z0-9_-]{15,}\b"),
    re.compile(
        r"""(?i)\b(?:DATABASE_URL|DIRECT_URL|SUPABASE_SERVICE_ROLE_KEY|"""
        r"""SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|JWT_SECRET|"""
        r"""PRIVATE_KEY|CLIENT_SECRET|AWS_SECRET_ACCESS_KEY|"""
        r"""API_SECRET|ACCESS_TOKEN|REFRESH_TOKEN)\s*["']?\s*[:=]\s*"""
        r"""["'](?!your_|replace_me|changeme|example|<)[^"' \r\n]{12,}["']"""
    ),
]

# Binary files and very large files are not content-scanned.
MAX_SCAN_BYTES = 2 * 1024 * 1024

if not (SOURCE / "package.json").is_file():
    sys.exit(
        "ERROR: No package.json found in the current directory.\n"
        "Change to your project's root folder and run this script again."
    )

# Place the clone beside the original, not inside it.
DEST = SOURCE.parent / (
    SOURCE.name + "-safe-copy-" + datetime.now().strftime("%Y%m%d-%H%M%S")
)

if DEST.exists():
    sys.exit(f"ERROR: Destination already exists: {DEST}")

report = []
copied = 0
skipped = 0

def is_excluded(path):
    name = path.name
    lower = name.lower()
    relative_parts = path.relative_to(SOURCE).parts

    if any(part in EXCLUDED_DIRS for part in relative_parts[:-1]):
        return True, "excluded directory"

    if name in EXCLUDED_NAMES:
        return True, "sensitive filename"

    if lower.startswith(".env"):
        return True, "environment file"

    if lower.endswith((".example", ".sample", ".template")):
        # Do not exclude harmless templates solely for this suffix.
        pass

    if lower.endswith(tuple(EXCLUDED_SUFFIXES)):
        return True, "private key, certificate or backup"

    if any(term in lower for term in EXCLUDED_FILENAMES_CONTAINING):
        return True, "potential credential file"

    # Common local database and credential exports.
    if lower.endswith((".sqlite", ".sqlite3", ".db")):
        return True, "local database file"

    if lower in {".npmrc", ".pypirc"}:
        return True, "package registry credentials"

    return False, ""

def has_secret_content(path):
    try:
        if path.stat().st_size > MAX_SCAN_BYTES:
            return False, "not scanned: file exceeds 2 MB"

        data = path.read_bytes()

        if b"\x00" in data[:8192]:
            return False, "binary file not content-scanned"

        content = data.decode("utf-8", errors="ignore")

        for pattern in SECRET_PATTERNS:
            if pattern.search(content):
                return True, "possible embedded credential"

        return False, ""
    except OSError as exc:
        return True, f"could not inspect file: {exc}"

try:
    DEST.mkdir(parents=True)

    for root, dirs, files in os.walk(SOURCE, followlinks=False):
        root_path = Path(root)

        # Prune excluded directories before descending into them.
        dirs[:] = sorted(
            d for d in dirs
            if d not in EXCLUDED_DIRS
            and not (root_path / d).is_symlink()
            and not d.endswith("-safe-copy")
        )

        for filename in sorted(files):
            source_file = root_path / filename
            relative = source_file.relative_to(SOURCE)
            target_file = DEST / relative

            if source_file.is_symlink():
                report.append(f"SKIPPED SYMLINK: {relative}")
                skipped += 1
                continue

            excluded, reason = is_excluded(source_file)
            if excluded:
                report.append(f"EXCLUDED ({reason}): {relative}")
                skipped += 1
                continue

            found_secret, reason = has_secret_content(source_file)
            if found_secret:
                report.append(f"NOT COPIED ({reason}): {relative}")
                skipped += 1
                continue

            target_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_file, target_file)
            copied += 1

    report_path = DEST / "SAFE_COPY_REPORT.txt"
    report_path.write_text(
        "SAFE PROJECT COPY REPORT\n"
        f"Original: {SOURCE}\n"
        f"Copy: {DEST}\n"
        f"Files copied: {copied}\n"
        f"Files skipped: {skipped}\n\n"
        "Files skipped or excluded:\n"
        + ("\n".join(report) if report else "None")
        + "\n\n"
        "IMPORTANT: This is a best-effort filter, not a guarantee that "
        "all secrets have been removed. Review source code, configuration, "
        "logs, documentation, and this report before sharing the copy.\n",
        encoding="utf-8",
    )

    print("\nSAFE COPY CREATED")
    print(f"Original folder : {SOURCE}")
    print(f"Safe copy       : {DEST}")
    print(f"Files copied    : {copied}")
    print(f"Files skipped   : {skipped}")
    print(f"Report          : {report_path}")
    print("\nReview SAFE_COPY_REPORT.txt before sharing the project.")

except Exception:
    print(
        "\nERROR: Copying failed. The original project was not modified.",
        file=sys.stderr,
    )
    raise
