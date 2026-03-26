import { NextRequest, NextResponse } from 'next/server';

const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request);
  const redirectUri = `${origin}/api/auth/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
  });

  return NextResponse.redirect(`https://${COGNITO_DOMAIN}/oauth2/authorize?${params}`);
}
