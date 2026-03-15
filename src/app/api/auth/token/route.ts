import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/verify-auth';

export async function GET(request: NextRequest) {
  const idToken = request.cookies.get('id_token')?.value;
  if (!idToken) {
    return NextResponse.json({ idToken: null }, { status: 401 });
  }

  // Verify token is still valid before returning it
  const user = await verifyToken(idToken);
  if (!user) {
    return NextResponse.json({ idToken: null }, { status: 401 });
  }

  return NextResponse.json({ idToken });
}
