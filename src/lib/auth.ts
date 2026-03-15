// OAuth-based auth helpers for Cognito Hosted UI SSO

const COGNITO_DOMAIN = 'auth.neuroplans.app';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Build the Cognito Hosted UI login URL.
 * After login, Cognito redirects to /api/auth/callback with an authorization code.
 */
export function getLoginUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
  });
  return `https://${COGNITO_DOMAIN}/oauth2/authorize?${params}`;
}

/**
 * Build the Cognito logout URL.
 */
export function getLogoutUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: redirectUri,
  });
  return `https://${COGNITO_DOMAIN}/logout?${params}`;
}

/**
 * Get the current user from the auth session (calls /api/auth/me).
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Get the ID token from the auth session cookie (calls /api/auth/token).
 */
export async function getIdToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/token');
    if (!res.ok) return null;
    const data = await res.json();
    return data.idToken || null;
  } catch {
    return null;
  }
}
