import { NextRequest, NextResponse } from 'next/server';

const COGNITO_DOMAIN = 'auth.neuroplans.app';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  const origin = getOrigin(request);
  const redirectUri = `${origin}/api/auth/callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/login?error=token_exchange', request.url));
  }

  const tokens = await tokenRes.json();
  const { id_token, access_token, refresh_token, expires_in } = tokens;

  // Set tokens in httpOnly cookies
  const response = NextResponse.redirect(new URL('/feedback', request.url));

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: expires_in || 3600,
  };

  response.cookies.set('id_token', id_token, cookieOptions);
  response.cookies.set('access_token', access_token, cookieOptions);
  if (refresh_token) {
    response.cookies.set('refresh_token', refresh_token, {
      ...cookieOptions,
      maxAge: 30 * 24 * 3600, // 30 days
    });
  }

  return response;
}
