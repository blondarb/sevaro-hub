import { createRemoteJWKSet, jwtVerify } from 'jose';

const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
const REGION = 'us-east-2';

const JWKS_URI = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(JWKS_URI));
  }
  return jwks;
}

export interface VerifiedUser {
  sub: string;
  email: string;
  isAdmin: boolean;
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'steve@sevaro.com')
  .split(',')
  .map((e) => e.trim().toLowerCase());

export async function verifyToken(token: string): Promise<VerifiedUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: ISSUER,
      audience: CLIENT_ID,
    });

    const email = (payload.email as string) || '';
    return {
      sub: payload.sub || '',
      email,
      isAdmin: ADMIN_EMAILS.includes(email.toLowerCase()),
    };
  } catch {
    return null;
  }
}

export function extractToken(request: Request): string | null {
  // Check Authorization header first (for direct API calls)
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }

  // Fall back to id_token cookie (for OAuth SSO flow)
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)id_token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}
