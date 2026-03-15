import { NextRequest, NextResponse } from 'next/server';

const COGNITO_DOMAIN = 'auth.neuroplans.app';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
  });

  return NextResponse.redirect(`https://${COGNITO_DOMAIN}/oauth2/authorize?${params}`);
}
