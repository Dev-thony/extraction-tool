#!/usr/bin/env python3
"""Safely patch the Extraction Tool project for 1,000-item batches, A-Z filtering,
Title Case names, and responsive admin layout. Creates timestamped backups first.

NOTE: The inspected project does not implement a daily quota. This script does not
invent one because upload-vs-processing accounting and concurrency policy need to
be explicit. It updates the existing per-batch 200-item cap to 1,000 and reports
that a true per-day quota is not present in this source tree.
"""
from pathlib import Path
from datetime import datetime
import re, sys, shutil

ROOT = Path.cwd().resolve()
if not (ROOT / 'package.json').exists() or not (ROOT / 'apps/extractor/app/api/batches/route.ts').exists():
    sys.exit('ERROR: Run this script from the root of the Extraction Tool project (the folder containing package.json and apps/).')

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
BACKUP = ROOT / '.repair-backups' / STAMP
CHANGES = []
WARNINGS = []

# Preflight: avoid silently applying partial or mismatched patches.
required = [
    'apps/extractor/app/page.tsx',
    'apps/extractor/app/api/batches/route.ts',
    'apps/extractor/app/api/batches/[id]/process/route.ts',
    'apps/admin/components/records-table.tsx',
    'apps/admin/app/api/records/route.ts',
    'apps/admin/app/api/records/[id]/route.ts',
    'apps/admin/app/globals.css',
    'packages/core/src/index.ts',
]
missing = [p for p in required if not (ROOT / p).is_file()]
if missing:
    sys.exit('ERROR: Expected project files missing; no files changed:\n' + '\n'.join(missing))


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def patch(rel, replacements):
    """replacements list: (old, new, expected_count=1); all checked before write."""
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    original = text
    for item in replacements:
        old, new = item[0], item[1]
        expected = item[2] if len(item) > 2 else 1
        count = text.count(old)
        if count != expected:
            raise RuntimeError(f'{rel}: expected {expected} occurrence(s) of anchor, found {count}: {old[:100]!r}')
        text = text.replace(old, new)
    if text != original:
        target = BACKUP / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        path.write_text(text, encoding='utf-8')
        CHANGES.append(rel)

try:
    # 1) Shared name formatter. Handles spaces, apostrophes and hyphenated names.
    helper_rel = 'packages/core/src/utils/name-format.ts'
    helper_path = ROOT / helper_rel
    helper_source = '''/** Normalize person/partnership names for display and persistence. */\nexport function toTitleCaseName(value: string | null | undefined): string | null {\n  if (value == null) return null;\n  const trimmed = value.trim().replace(/\\s+/g, ' ');\n  if (!trimmed) return null;\n  return trimmed.toLocaleLowerCase().replace(/(^|[\\s\\-'’])([\\p{L}\\p{N}])/gu, (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase());\n}\n'''
    if not helper_path.exists():
        BACKUP.mkdir(parents=True, exist_ok=True)
        helper_path.parent.mkdir(parents=True, exist_ok=True)
        helper_path.write_text(helper_source, encoding='utf-8')
        CHANGES.append(helper_rel + ' (created)')
    else:
        if 'toTitleCaseName' not in helper_path.read_text(encoding='utf-8'):
            raise RuntimeError(f'{helper_rel} already exists but does not contain toTitleCaseName; inspect manually.')

    patch('packages/core/src/index.ts', [
        ("export * from './env';", "export * from './env';\nexport * from './utils/name-format';")
    ])

    # 2) Raise existing per-batch cap. The repository contains no daily quota code.
    patch('apps/extractor/app/page.tsx', [
        ('const MAX_LOCAL_FILES = 200;', 'const MAX_LOCAL_FILES = 1000;'),
        ('Up to 200 images', 'Up to 1,000 images'),
    ])
    patch('apps/extractor/app/api/batches/route.ts', [
        ('const MAX_BATCH_ITEMS = 200;', 'const MAX_BATCH_ITEMS = 1000;'),
    ])

    # 3) Title-case extracted names before writing newly processed records.
    patch('apps/extractor/app/api/batches/[id]/process/route.ts', [
        ("import { getEnv, getOcrProvider, getStorageProvider, runExtraction } from '@extraction/core';", "import { getEnv, getOcrProvider, getStorageProvider, runExtraction, toTitleCaseName } from '@extraction/core';"),
        ('fullName: extracted.fields.fullName,', 'fullName: toTitleCaseName(extracted.fields.fullName),'),
        ('userName: extracted.fields.userName,', 'userName: toTitleCaseName(extracted.fields.userName),'),
    ])

    # 4) Title-case names edited in admin and normalize legacy names in table display.
    patch('apps/admin/app/api/records/[id]/route.ts', [
        ("import { UpdateRecordInputSchema } from '@extraction/types';", "import { UpdateRecordInputSchema } from '@extraction/types';\nimport { toTitleCaseName } from '@extraction/core';"),
        ('data: input,', "data: {\n        ...input,\n        ...(Object.prototype.hasOwnProperty.call(input, 'fullName') ? { fullName: toTitleCaseName(input.fullName) } : {}),\n        ...(Object.prototype.hasOwnProperty.call(input, 'userName') ? { userName: toTitleCaseName(input.userName) } : {}),\n      },"),
    ])
    patch('apps/admin/components/records-table.tsx', [
        ("import { exportRecords } from '../lib/export-records';", "import { exportRecords } from '../lib/export-records';\nimport { toTitleCaseName } from '@extraction/core';"),
        ("  const [status, setStatus] = useState<ProcessingStatus | ''>('');", "  const [status, setStatus] = useState<ProcessingStatus | ''>('');\n\n  const [alphaFilter, setAlphaFilter] = useState('');"),
        ("      params.set('sortDir', sortDir);", "      params.set('sortDir', sortDir);\n      if (alphaFilter) params.set('firstLetter', alphaFilter);"),
        ('[page, sortBy, sortDir, search, status, dateFrom, dateTo]', '[page, sortBy, sortDir, search, status, dateFrom, dateTo, alphaFilter]'),
        ("    setStatus('');\n    setDateFrom('');", "    setStatus('');\n    setAlphaFilter('');\n    setDateFrom('');"),
        ('''        <select\n          value={status}\n          onChange={(event) => {\n            setStatus(event.target.value as ProcessingStatus | '');\n            setPage(1);\n          }}\n        >''', '''        <select\n          value={status}\n          onChange={(event) => {\n            setStatus(event.target.value as ProcessingStatus | '');\n            setPage(1);\n          }}\n        >'''),
        ('''        <input\n          type="date"\n          value={dateFrom}''', '''        <select\n          aria-label="Filter names by first letter"\n          value={alphaFilter}\n          onChange={(event) => { setAlphaFilter(event.target.value); setPage(1); }}\n        >\n          <option value="">All letters</option>\n          {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (\n            <option key={letter} value={letter}>{letter}</option>\n          ))}\n        </select>\n\n        <input\n          type="date"\n          value={dateFrom}'''),
        ("{record.fullName || 'Unnamed'}", "{toTitleCaseName(record.fullName) || 'Unnamed'}"),
        ('<td>{record.userName || \'—\'}</td>', '<td>{toTitleCaseName(record.userName) || \'—\'}</td>'),
    ])

    # Add server-side first-letter filtering, so the filter covers all records, not just current page.
    patch('apps/admin/app/api/records/route.ts', [
        ("    const { searchParams } = new URL(request.url);", "    const { searchParams } = new URL(request.url);\n    const firstLetterRaw = searchParams.get('firstLetter')?.trim().toLocaleUpperCase() ?? '';\n    const firstLetter = /^[A-Z]$/.test(firstLetterRaw) ? firstLetterRaw : '';"),
        ('''      ...(status\n        ? {\n            status,\n          }\n        : {}),''', '''      ...(status\n        ? {\n            status,\n          }\n        : {}),\n\n      ...(firstLetter\n        ? { fullName: { startsWith: firstLetter, mode: 'insensitive' as const } }\n        : {}),'''),
    ])

    # 5) Responsive hardening: mobile toolbar wraps, content does not overflow viewport,
    # tables remain horizontally scrollable rather than squeezing every column.
    css_rel = 'apps/admin/app/globals.css'
    css = read(css_rel)
    responsive_marker = '/* Extraction Tool responsive repair additions */'
    if responsive_marker not in css:
        append_css = '''\n\n/* Extraction Tool responsive repair additions */\n.admin-shell, .admin-main, .admin-content, .records-page { min-width: 0; max-width: 100%; }\n.records-toolbar, .records-actions, .records-action-group, .records-export-row { display: flex; flex-wrap: wrap; gap: 0.65rem; }\n.records-toolbar > *, .records-search { min-width: 0; max-width: 100%; }\n.admin-table-wrapper { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }\n.admin-table { min-width: 760px; }\ninput, select, textarea { max-width: 100%; }\n@media (max-width: 768px) {\n  .admin-content { padding: 1rem !important; }\n  .records-toolbar { display: grid; grid-template-columns: minmax(0, 1fr); }\n  .records-toolbar > *, .records-search, .records-search input { width: 100%; }\n  .records-actions { align-items: stretch; flex-direction: column; }\n  .records-action-group { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }\n  .records-action-group button { min-width: 0; white-space: normal; }\n  .records-export-row { align-items: center; flex-wrap: wrap; }\n}\n@media (max-width: 420px) {\n  .records-action-group { grid-template-columns: minmax(0, 1fr); }\n}\n'''
        target = ROOT / css_rel
        backup = BACKUP / css_rel
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, backup)
        target.write_text(css + append_css, encoding='utf-8')
        CHANGES.append(css_rel)

except Exception as exc:
    # Roll back changed existing files if a patch anchor mismatches.
    for rel in reversed(CHANGES):
        clean_rel = rel.replace(' (created)', '')
        backup_path = BACKUP / clean_rel
        original_path = ROOT / clean_rel
        if backup_path.exists():
            original_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup_path, original_path)
        elif rel.endswith(' (created)') and original_path.exists():
            original_path.unlink()
    sys.exit(f'ERROR: No partial repair left behind; changes rolled back. Details: {exc}')

# Determine whether explicit daily quota code exists; do not claim it was updated if absent.
search_files = []
for base in (ROOT / 'apps', ROOT / 'packages'):
    if base.exists():
        search_files.extend(p for p in base.rglob('*') if p.is_file() and p.suffix in {'.ts', '.tsx', '.js', '.jsx', '.prisma', '.sql'})
quota_hits = []
for p in search_files:
    try:
        text = p.read_text(encoding='utf-8', errors='ignore')
    except OSError:
        continue
    if re.search(r'daily.?quota|daily.?limit|per.?day.?limit|limit.?per.?day|upload.?quota|processing.?quota', text, re.I):
        quota_hits.append(str(p.relative_to(ROOT)))

report = ROOT / f'REPAIR_REPORT_{STAMP}.txt'
report.write_text(
    'EXTRACTION TOOL REPAIR REPORT\n'
    f'Project root: {ROOT}\n'
    f'Backup directory: {BACKUP}\n'
    f'Files changed: {len(CHANGES)}\n\n'
    + '\n'.join(CHANGES) + '\n\n'
    + 'DAILY LIMIT FINDING:\n'
    + ('Potential quota-related files found:\n' + '\n'.join(quota_hits) if quota_hits else
       'No explicit daily quota implementation was found in the inspected source files. The script changed the existing per-batch upload cap from 200 to 1,000, but did NOT implement a separate 1,000-per-day quota. Do not treat these as equivalent. A safe daily quota requires a defined unit (uploaded images vs processed images) and transaction/concurrency handling.\n')
    + '\nNEXT STEPS:\n'
    + '1. Review the diff and repair report.\n'
    + '2. Run npm install if needed, then npm run typecheck/build using the project scripts.\n'
    + '3. Test a small upload, a failed upload, A-Z filtering, editing a name, and mobile layouts.\n'
    + '4. Confirm the daily quota policy before implementing a separate day-based counter.\n',
    encoding='utf-8'
)
print('REPAIR COMPLETED')
print(f'Project: {ROOT}')
print(f'Backups: {BACKUP}')
print(f'Changed files: {len(CHANGES)}')
for rel in CHANGES:
    print('  -', rel)
print(f'Report: {report}')
if not quota_hits:
    print('\nIMPORTANT: No separate daily quota was found. Existing batch cap is now 1,000; a true per-day quota still needs explicit implementation.')
