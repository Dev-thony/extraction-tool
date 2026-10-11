import { readFile } from 'node:fs/promises';
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
