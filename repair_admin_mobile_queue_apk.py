#!/usr/bin/env python3
"""Targeted repair for Extraction Tool admin responsiveness, queue proxy, and APK download.

Run from the monorepo root. Creates a timestamped backup before editing.
Does not edit secrets or database records.
"""
from pathlib import Path
from datetime import datetime
import shutil
import sys

ROOT = Path.cwd().resolve()
REQUIRED = [
    ROOT / 'apps/admin/app/globals.css',
    ROOT / 'apps/admin/components/record-editor.tsx',
    ROOT / 'apps/admin/components/batch-detail.tsx',
    ROOT / 'apps/admin/public/downloads/Data-Extractor-Admin.apk',
]
missing = [str(p.relative_to(ROOT)) for p in REQUIRED if not p.exists()]
if missing:
    sys.exit('Run this from the project root. Missing required paths:\n- ' + '\n- '.join(missing))

stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
BACKUP = ROOT / '.repair-backups' / f'mobile-queue-apk-{stamp}'
BACKUP.mkdir(parents=True, exist_ok=False)
changed = []
created = []


def backup(path: Path):
    dest = BACKUP / path.relative_to(ROOT)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)


def write_if_changed(path: Path, old: str, new: str):
    if old == new:
        return False
    backup(path)
    path.write_text(new, encoding='utf-8')
    changed.append(str(path.relative_to(ROOT)))
    return True

try:
    # 1) CSS: final overrides intentionally come last because the existing stylesheet
    # contains several legacy/repeated sidebar media-query blocks.
    css_path = ROOT / 'apps/admin/app/globals.css'
    css = css_path.read_text(encoding='utf-8')
    marker = '/* SAFE REPAIR: mobile/tablet admin and record editor layout */'
    if marker not in css:
        css += '''\n\n/* SAFE REPAIR: mobile/tablet admin and record editor layout */
.admin-shell { min-width: 0; width: 100%; }
.admin-main { min-width: 0; width: 100%; }
.admin-content { min-width: 0; max-width: 100%; }
.record-editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 20px;
  min-width: 0;
}
.record-editor-layout > * { min-width: 0; }
.record-editor-layout img, .record-editor-layout video, .record-editor-layout canvas {
  max-width: 100%; height: auto;
}
.batch-detail-page, .batch-panel, .records-page, .records-table-wrapper { min-width: 0; max-width: 100%; }
.records-table-wrapper, .table-responsive, .admin-table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.records-table, .admin-table { min-width: 640px; }
.admin-page-header, .batch-detail-actions, .records-toolbar, .records-actions, .records-action-group {
  min-width: 0; flex-wrap: wrap;
}
.admin-page-header > *, .batch-detail-actions > * { min-width: 0; }
@media (max-width: 1100px) {
  .admin-content { padding: 24px; }
  .record-editor-layout { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
}
@media (max-width: 900px) {
  .admin-content { padding: 20px; }
  .record-editor-layout { grid-template-columns: minmax(0, 1fr); }
  .admin-page-header { align-items: flex-start; gap: 14px; }
  .batch-detail-actions { width: 100%; }
  .batch-detail-actions .admin-button { flex: 1 1 auto; }
  .records-search { flex: 1 1 100%; min-width: 0; }
  .records-toolbar input, .records-toolbar select { max-width: 100%; }
}
@media (max-width: 640px) {
  .admin-content { padding: 14px; }
  .admin-content h1 { font-size: clamp(1.45rem, 6vw, 1.9rem) !important; overflow-wrap: anywhere; }
  .record-editor-layout { gap: 14px; }
  .record-editor-layout .card { padding: 16px !important; }
  .admin-page-header { flex-direction: column; }
  .batch-detail-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .batch-detail-actions .admin-button { width: 100%; min-width: 0; white-space: normal; }
  .records-actions { align-items: stretch; }
  .records-action-group { width: 100%; }
  .records-action-group > button, .records-action-group > a { flex: 1 1 auto; }
  .records-toolbar > * { min-width: 0; width: 100%; }
  .records-search { width: 100%; }
  .batch-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 380px) {
  .admin-content { padding: 10px; }
  .batch-detail-actions { grid-template-columns: minmax(0, 1fr); }
  .batch-stat-grid { grid-template-columns: minmax(0, 1fr); }
}
'''
        backup(css_path)
        css_path.write_text(css, encoding='utf-8')
        changed.append(str(css_path.relative_to(ROOT)))

    # 2) Remove the inline two-column grid so CSS media queries can control it.
    editor_path = ROOT / 'apps/admin/components/record-editor.tsx'
    editor = editor_path.read_text(encoding='utf-8')
    old_grid = '''      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 1fr) minmax(360px, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >'''
    new_grid = '      <div className="record-editor-layout">'
    if old_grid in editor:
        write_if_changed(editor_path, editor, editor.replace(old_grid, new_grid, 1))
    elif 'className="record-editor-layout"' not in editor:
        print('WARNING: Could not find the expected RecordEditor inline grid; CSS override still applied.')

    # 3) Add a protected admin-side proxy to the extractor processing endpoint.
    # EXTRACTOR_API_URL must be configured in admin's environment (origin only).
    route_path = ROOT / 'apps/admin/app/api/batches/[id]/process/route.ts'
    if not route_path.exists():
        route_path.parent.mkdir(parents=True, exist_ok=True)
        route_path.write_text('''import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    const base = process.env.EXTRACTOR_API_URL?.trim().replace(/\\/$/, '');

    if (!base) {
      return NextResponse.json(
        { success: false, error: 'Queue processing is not configured. Set EXTRACTOR_API_URL in the admin app environment to the deployed extractor origin.' },
        { status: 503 },
      );
    }

    let body: unknown = {};
    try { body = await request.json(); } catch { /* empty request body is valid */ }

    const upstream = await fetch(`${base}/api/batches/${encodeURIComponent(id)}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    });

    const payload = await upstream.json().catch(() => ({
      success: false,
      error: `Extractor returned a non-JSON response (HTTP ${upstream.status}).`,
    }));

    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    console.error('Admin queue processing proxy failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return NextResponse.json(
      { success: false, error: `Could not reach the extractor processing service: ${message}` },
      { status: 502 },
    );
  }
}
''', encoding='utf-8')
        created.append(str(route_path.relative_to(ROOT)))
    else:
        print('NOTE: Admin process proxy route already exists; left unchanged.')

    # 4) Ensure direct APK download is served as an attachment from admin app.
    apk_route = ROOT / 'apps/admin/app/api/download-apk/route.ts'
    if not apk_route.exists():
        apk_route.parent.mkdir(parents=True, exist_ok=True)
        apk_route.write_text('''import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apkPath = join(process.cwd(), 'public', 'downloads', 'Data-Extractor-Admin.apk');
    const apk = await readFile(apkPath);
    return new NextResponse(apk, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="Data-Extractor-Admin.apk"',
        'Content-Length': String(apk.byteLength),
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('APK download failed:', error);
    return NextResponse.json(
      { error: 'The APK file is missing from apps/admin/public/downloads.' },
      { status: 404 },
    );
  }
}
''', encoding='utf-8')
        created.append(str(apk_route.relative_to(ROOT)))
    else:
        print('NOTE: APK download API route already exists; left unchanged.')

    # 5) Make batch detail surface server errors returned with HTTP 200 as actual errors.
    batch_path = ROOT / 'apps/admin/components/batch-detail.tsx'
    batch = batch_path.read_text(encoding='utf-8')
    old = '''      if (!response.ok) {
        throw new Error(result?.error || 'Could not process the next queued item.');
      }

      setNotice('Processing request completed.');
      await refresh();'''
    new = '''      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'Could not process the next queued item.');
      }

      setNotice(result?.message || (result?.done ? 'No queued items remain.' : 'Processing request completed.'));
      await refresh();'''
    if old in batch:
        write_if_changed(batch_path, batch, batch.replace(old, new, 1))
    else:
        print('WARNING: Could not find expected processQueue response handling; left component unchanged.')

    report = ROOT / f'REPAIR_REPORT_mobile-queue-apk_{stamp}.txt'
    report.write_text(
        'EXTRACTION TOOL MOBILE / QUEUE / APK REPAIR REPORT\n'
        f'Project root: {ROOT}\n'
        f'Backup directory: {BACKUP}\n'
        f'Changed files: {len(changed)}\n'
        f'Created files: {len(created)}\n\n'
        'CHANGED FILES:\n' + ('\n'.join(changed) or 'None') + '\n\n'
        'CREATED FILES:\n' + ('\n'.join(created) or 'None') + '\n\n'
        'REQUIRED CONFIGURATION:\n'
        'Set EXTRACTOR_API_URL on the ADMIN app to the extractor deployment origin, e.g. https://your-extractor-domain.example (no trailing slash). Do not put credentials in this value.\n\n'
        'IMPORTANT GOOGLE DRIVE LIMITATION:\n'
        'The current Drive preparation route intentionally stores Drive file IDs but does not download image bytes or persist OAuth tokens. Existing Drive queue items without sourceKey cannot be processed from the admin portal unless a valid Google Drive access token is supplied to the extractor process endpoint. This script does not persist OAuth tokens or alter existing database records. The correct durable fix is to stage each selected Drive image into configured storage while the user is authorized during batch creation, then queue it with sourceKey set. Existing batches may need reauthorization/reselection or a controlled recovery flow.\n\n'
        'APK:\n'
        'New endpoint: /api/download-apk. It sends apps/admin/public/downloads/Data-Extractor-Admin.apk as an attachment. Confirm the APK is tracked by Git and deployed; the endpoint cannot download a file that is absent from the deployment.\n\n'
        'NEXT STEPS:\n'
        '1. Review changes and report.\n'
        '2. Configure EXTRACTOR_API_URL for local admin and the Vercel admin project.\n'
        '3. Run npm run typecheck --workspaces --if-present and npm run build.\n'
        '4. Test admin mobile/tablet layouts, local queue processing, and the APK endpoint.\n'
        '5. Do not assume existing Drive queue items are repaired until their sourceKey/token situation is resolved.\n',
        encoding='utf-8',
    )
    print('\nRepair patches applied.')
    print('Backup:', BACKUP)
    print('Changed files:')
    for item in changed: print('  ', item)
    print('Created files:')
    for item in created: print('  ', item)
    print('Report:', report)
    print('\nRemember: set EXTRACTOR_API_URL for the admin app before testing queue processing.')
except Exception as exc:
    print(f'ERROR: {exc}', file=sys.stderr)
    print(f'Backups (if any) are in: {BACKUP}', file=sys.stderr)
    sys.exit(1)
