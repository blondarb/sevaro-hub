import { NextResponse } from 'next/server';
import { verifyToken, extractToken } from '@/lib/verify-auth';

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }

  return NextResponse.json({ isAdmin: user.isAdmin, email: user.email });
}
