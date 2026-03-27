import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/verify-auth';

const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

export async function GET(request: NextRequest) {
  const idToken = request.cookies.get('id_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // Try existing id_token first
  if (idToken) {
    const user = await verifyToken(idToken);
    if (user) {
      return NextResponse.json({ idToken });
    }
  }

  // id_token missing or expired — try refresh
  if (refreshToken && COGNITO_DOMAIN && CLIENT_ID) {
    try {
      const tokenRes = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: CLIENT_ID,
          refresh_token: refreshToken,
        }),
      });

      if (tokenRes.ok) {
        const tokens = await tokenRes.json();
        const newIdToken = tokens.id_token;
        const expiresIn = tokens.expires_in || 3600;

        // Verify the new token before returning it
        const user = await verifyToken(newIdToken);
        if (user) {
          const response = NextResponse.json({ idToken: newIdToken });

          const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'lax' as const,
            path: '/',
            maxAge: expiresIn,
          };

          response.cookies.set('id_token', newIdToken, cookieOptions);
          if (tokens.access_token) {
            response.cookies.set('access_token', tokens.access_token, cookieOptions);
          }

          return response;
        }
      }
    } catch {
      // Refresh failed — fall through to 401
    }
  }

  return NextResponse.json({ idToken: null }, { status: 401 });
}
