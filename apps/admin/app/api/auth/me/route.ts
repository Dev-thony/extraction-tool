import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../../lib/auth';

export async function GET() {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  });
}
