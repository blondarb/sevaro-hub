import { NextRequest, NextResponse } from 'next/server';

const COGNITO_DOMAIN = 'auth.neuroplans.app';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

function getOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: origin,
  });

  const response = NextResponse.redirect(`https://${COGNITO_DOMAIN}/logout?${params}`);

  // Clear auth cookies
  response.cookies.delete('id_token');
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');

  return response;
}
