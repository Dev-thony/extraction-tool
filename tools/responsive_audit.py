#!/usr/bin/env python3
"""
Responsive UI audit + conservative CSS hardening for the Data Extractor monorepo.

Usage from the repository root:
  python tools/responsive_audit.py              # audit only
  python tools/responsive_audit.py --apply      # back up and append safe CSS
  python tools/responsive_audit.py --check      # audit and exit non-zero on warnings
  python tools/responsive_audit.py --restore    # restore the latest generated backups

This tool deliberately does not rewrite TSX/JSX or remove features. It:
- scans the extractor and admin app source for common responsive risk patterns;
- creates timestamped backups before changing CSS;
- appends an idempotent, conservative responsive CSS layer to each app's globals.css;
- writes a Markdown report under reports/responsive-audit.md.

A CSS-only tool cannot guarantee perfect responsive behavior. Review the report and
test the running app at real viewport widths after applying changes.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path.cwd()
APPS = {
    "extractor": ROOT / "apps" / "extractor",
    "admin": ROOT / "apps" / "admin",
}
REPORT_PATH = ROOT / "reports" / "responsive-audit.md"
BACKUP_DIR = ROOT / ".responsive-audit-backups"
MARKER_START = "/* BEGIN GENERATED RESPONSIVE HARDENING - responsive_audit.py */"
MARKER_END = "/* END GENERATED RESPONSIVE HARDENING - responsive_audit.py */"

COMMON_CSS = r"""
/* Generated, conservative responsive hardening. Review before production. */
:root {
  color-scheme: light;
  --responsive-page-gutter: clamp(12px, 3vw, 28px);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  width: 100%;
  min-width: 320px;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  width: 100%;
  min-width: 320px;
  margin: 0;
  overflow-wrap: anywhere;
}

img,
picture,
video,
canvas,
svg {
  max-width: 100%;
}

img,
video {
  height: auto;
}

input,
select,
textarea,
button {
  max-width: 100%;
  min-width: 0;
}

button,
a,
[role="button"] {
  touch-action: manipulation;
}

pre,
code {
  overflow-wrap: anywhere;
  word-break: break-word;
}

table {
  max-width: 100%;
}

@media (max-width: 768px) {
  input,
  select,
  textarea,
  button {
    font-size: max(16px, 1em);
  }
}
"""

EXTRACTOR_CSS = r"""
/* Extractor-specific safe layout guards */
.extractor-page,
.extractor-container,
.upload-card,
.queue-card,
.results-card,
.selected-files,
.drive-selection {
  min-width: 0;
  max-width: 100%;
}

.extractor-page {
  padding-left: clamp(12px, 3vw, 20px);
  padding-right: clamp(12px, 3vw, 20px);
}

.extractor-header h1 {
  font-size: clamp(26px, 4vw, 36px);
  overflow-wrap: anywhere;
}

.source-actions,
.upload-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.preview-grid,
.results-grid,
.drive-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 16px;
}

.preview-item,
.result-person,
.drive-item,
.queue-item,
.queue-file {
  min-width: 0;
  max-width: 100%;
}

.preview-item img {
  display: block;
  width: 100%;
  max-height: 300px;
  object-fit: contain;
}

.preview-name,
.drive-item strong,
.result-field strong,
.queue-file strong {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.drive-ready {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

@media (max-width: 640px) {
  .extractor-page {
    padding-top: 24px;
    padding-bottom: 24px;
  }

  .upload-card,
  .queue-card,
  .results-card {
    padding: 14px;
  }

  .source-actions,
  .upload-actions {
    flex-direction: column;
  }

  .source-actions > *,
  .upload-actions > *,
  .drive-ready .extract-button,
  .batch-action-row .extract-button {
    width: 100%;
  }

  .preview-grid,
  .results-grid,
  .drive-items {
    grid-template-columns: minmax(0, 1fr);
  }

  .drop-zone {
    padding: 32px 14px;
  }

  .selected-header,
  .queue-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .batch-action-row {
    align-items: stretch;
    flex-direction: column;
  }

  .image-container {
    min-height: 180px;
  }
}
"""

ADMIN_CSS = r"""
/* Admin-specific safe layout guards */
.admin-shell,
.admin-main,
.admin-content,
.admin-table-card,
.admin-table-wrapper,
.batch-panel {
  min-width: 0;
  max-width: 100%;
}

.admin-main {
  flex: 1 1 auto;
}

.admin-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.admin-table-wrapper table {
  max-width: none;
}

.admin-page-header,
.records-toolbar,
.records-actions,
.records-action-group,
.batch-filters,
.batch-detail-actions {
  min-width: 0;
  max-width: 100%;
  flex-wrap: wrap;
}

.admin-main input,
.admin-main select,
.admin-main textarea {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 800px) {
  .admin-shell {
    display: flex;
    flex-direction: column;
  }

  .admin-sidebar {
    position: relative !important;
    inset: auto !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0;
    flex: 0 0 auto;
  }

  .admin-sidebar > div:last-child {
    position: static !important;
    inset: auto !important;
    width: auto !important;
  }

  .admin-sidebar nav {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .admin-sidebar nav a {
    flex: 1 1 auto;
    min-width: max-content;
    justify-content: center;
  }

  .admin-main {
    width: 100%;
    min-width: 0;
  }

  .admin-content {
    min-width: 0;
    max-width: 100%;
    padding: clamp(12px, 3vw, 24px);
  }

  .admin-table-wrapper table {
    min-width: 680px;
  }
}

@media (max-width: 480px) {
  .admin-content {
    padding: 12px;
  }

  .admin-table-wrapper table {
    min-width: 620px;
  }

  .admin-page-header {
    align-items: flex-start;
    gap: 12px;
  }
}
"""

SOURCE_EXTENSIONS = {".css", ".tsx", ".ts", ".jsx", ".js"}
SKIP_PARTS = {"node_modules", ".next", "dist", "build", ".git", "coverage"}

PATTERNS = [
    ("fixed pixel width", re.compile(r"\b(?:width|min-width|max-width)\s*:\s*\d{3,4}px", re.I),
     "Fixed pixel width may overflow narrow viewports; consider max-width: 100% and a fluid width."),
    ("fixed positioning", re.compile(r"\bposition\s*:\s*fixed\b", re.I),
     "Fixed-position elements can cover content on mobile; verify their small-screen behavior."),
    ("absolute positioning", re.compile(r"\bposition\s*:\s*absolute\b", re.I),
     "Absolutely positioned content can overlap or escape its parent on narrow screens."),
    ("non-wrapping flex row", re.compile(r"display\s*:\s*flex(?:(?!\}).){0,220}?(?:white-space\s*:\s*nowrap)", re.I | re.S),
     "A flex row with non-wrapping text may overflow; consider flex-wrap and min-width: 0."),
    ("large fixed grid minimum", re.compile(r"minmax\(\s*\d{3,4}px", re.I),
     "A grid column has a large fixed minimum; consider minmax(0, 1fr) or auto-fit."),
    ("viewport width usage", re.compile(r"\bwidth\s*:\s*100vw\b", re.I),
     "100vw can include scrollbar width; consider width: 100% where appropriate."),
    ("horizontal overflow suppression", re.compile(r"overflow-x\s*:\s*hidden", re.I),
     "overflow-x:hidden can conceal layout defects; confirm this is intentional."),
]

def iter_source_files(app_root: Path) -> Iterable[Path]:
    for path in app_root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        yield path

def audit_app(name: str, app_root: Path) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    if not app_root.exists():
        findings.append({
            "app": name, "file": str(app_root.relative_to(ROOT)), "line": 0,
            "severity": "ERROR", "pattern": "app folder missing",
            "detail": "Expected app folder was not found."
        })
        return findings

    for path in iter_source_files(app_root):
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            findings.append({
                "app": name, "file": str(path.relative_to(ROOT)), "line": 0,
                "severity": "WARN", "pattern": "read failure", "detail": str(exc)
            })
            continue
        for label, pattern, advice in PATTERNS:
            for match in pattern.finditer(content):
                line = content.count("\n", 0, match.start()) + 1
                findings.append({
                    "app": name, "file": str(path.relative_to(ROOT)), "line": line,
                    "severity": "REVIEW", "pattern": label, "detail": advice
                })
    return findings

def strip_generated_block(content: str) -> str:
    start = content.find(MARKER_START)
    end = content.find(MARKER_END)
    if start >= 0 and end >= start:
        end += len(MARKER_END)
        return content[:start].rstrip() + "\n"
    return content

def build_generated_css(app_name: str) -> str:
    specific = EXTRACTOR_CSS if app_name == "extractor" else ADMIN_CSS
    return f"\n\n{MARKER_START}\n{COMMON_CSS}\n{specific}\n{MARKER_END}\n"

def apply_css(app_name: str, app_root: Path, timestamp: str) -> tuple[bool, str]:
    css_path = app_root / "app" / "globals.css"
    if not css_path.exists():
        return False, f"Skipped {css_path.relative_to(ROOT)}: file not found."
    original = css_path.read_text(encoding="utf-8")
    cleaned = strip_generated_block(original)
    if cleaned != original:
        action = "updated existing generated block"
    else:
        action = "added generated block"

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backup_path = BACKUP_DIR / f"{app_name}-globals.css.{timestamp}.bak"
    shutil.copy2(css_path, backup_path)

    css_path.write_text(cleaned.rstrip() + build_generated_css(app_name), encoding="utf-8")
    return True, f"{action}: {css_path.relative_to(ROOT)} (backup: {backup_path.relative_to(ROOT)})"

def write_report(findings: list[dict[str, object]], applied_messages: list[str]) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now().astimezone().isoformat(timespec="seconds")
    lines = [
        "# Responsive UI Audit",
        "",
        f"- Generated: `{now}`",
        "- Scope: `apps/extractor` and `apps/admin`",
        "- This report identifies risks, not guaranteed defects. Review each finding in context.",
        "",
        "## Automated changes",
        "",
    ]
    if applied_messages:
        lines.extend(f"- {msg}" for msg in applied_messages)
    else:
        lines.append("- No CSS changes applied in this run.")
    lines += ["", "## Findings", ""]
    if not findings:
        lines.append("No common responsive risk patterns were detected by this lightweight scan.")
    else:
        lines += ["| Severity | App | File | Line | Pattern | Suggested review |",
                  "|---|---|---|---:|---|---|"]
        for f in findings:
            detail = str(f["detail"]).replace("|", "\\|")
            lines.append(
                f'| {f["severity"]} | {f["app"]} | `{f["file"]}` | {f["line"]} | '
                f'{f["pattern"]} | {detail} |'
            )
    lines += [
        "",
        "## Manual viewport checklist",
        "",
        "- [ ] 320px: no page-level horizontal overflow; controls remain usable.",
        "- [ ] 375–390px: forms, filters, and action buttons wrap cleanly.",
        "- [ ] 768px: navigation and dashboard cards fit without overlap.",
        "- [ ] 1024px: table and detail layouts use available space appropriately.",
        "- [ ] 1280px+: desktop layout remains intact.",
        "- [ ] Test extractor uploads, image removal, Google Drive selection, and batch processing.",
        "- [ ] Test admin dashboard, record filters/exports, record editor, batch actions, and sign-out.",
        "- [ ] Check browser console and network requests for runtime errors.",
        "",
        "## Limitations",
        "",
        "This tool does not rewrite React components or infer intended design. It applies conservative CSS guards only. "
        "Use browser device emulation or Playwright screenshots for visual validation before production.",
        "",
    ]
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")

def restore_latest() -> int:
    if not BACKUP_DIR.exists():
        print("No responsive-audit backups found.")
        return 1
    restored = 0
    for app_name, app_root in APPS.items():
        candidates = sorted(BACKUP_DIR.glob(f"{app_name}-globals.css.*.bak"))
        if not candidates:
            continue
        backup = candidates[-1]
        target = app_root / "app" / "globals.css"
        if not target.parent.exists():
            print(f"Cannot restore {target}: app folder missing.")
            continue
        shutil.copy2(backup, target)
        print(f"Restored {target.relative_to(ROOT)} from {backup.relative_to(ROOT)}")
        restored += 1
    return 0 if restored else 1

def main() -> int:
    parser = argparse.ArgumentParser(description="Audit and conservatively harden responsive CSS.")
    parser.add_argument("--apply", action="store_true", help="Back up globals.css and append safe responsive CSS.")
    parser.add_argument("--check", action="store_true", help="Exit with code 2 if REVIEW/ERROR findings exist.")
    parser.add_argument("--restore", action="store_true", help="Restore latest backups of globals.css.")
    args = parser.parse_args()

    if args.restore:
        return restore_latest()

    missing = [name for name, path in APPS.items() if not path.exists()]
    if missing:
        print("Run this script from the monorepo root. Missing: " + ", ".join(missing), file=sys.stderr)
        return 1

    findings: list[dict[str, object]] = []
    for name, app_root in APPS.items():
        findings.extend(audit_app(name, app_root))

    applied_messages: list[str] = []
    if args.apply:
        timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        for name, app_root in APPS.items():
            ok, message = apply_css(name, app_root, timestamp)
            applied_messages.append(message)
            print(message)
            if not ok:
                print(message, file=sys.stderr)

    write_report(findings, applied_messages)
    print(f"\nAudit report written to: {REPORT_PATH.relative_to(ROOT)}")
    print(f"Responsive risk findings: {len(findings)}")
    print("No TSX/JSX files were changed.")

    if args.check and findings:
        return 2
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
