import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await context.params;
    const base = process.env.EXTRACTOR_API_URL?.trim().replace(/\/$/, '');

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
