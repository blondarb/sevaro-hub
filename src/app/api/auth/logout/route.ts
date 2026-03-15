import { NextRequest, NextResponse } from 'next/server';

const COGNITO_DOMAIN = 'auth.neuroplans.app';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

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
