import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/verify-auth';

export async function GET(request: NextRequest) {
  const idToken = request.cookies.get('id_token')?.value;
  if (!idToken) {
    return NextResponse.json(null, { status: 401 });
  }

  const user = await verifyToken(idToken);
  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  return NextResponse.json({
    id: user.sub,
    email: user.email,
  });
}
