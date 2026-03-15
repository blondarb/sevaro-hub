import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

export interface AuthUser {
  id: string;
  email: string;
}

function getUserPool(): CognitoUserPool {
  return new CognitoUserPool({
    UserPoolId: USER_POOL_ID,
    ClientId: CLIENT_ID,
  });
}

export function getCurrentUser(): Promise<AuthUser | null> {
  return new Promise((resolve) => {
    const pool = getUserPool();
    const cognitoUser = pool.getCurrentUser();
    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      const payload = session.getIdToken().decodePayload();
      resolve({
        id: payload.sub,
        email: payload.email,
      });
    });
  });
}

export function getIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const pool = getUserPool();
    const cognitoUser = pool.getCurrentUser();
    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

export function signIn(
  email: string,
  password: string,
): Promise<{ error: string | null; newPasswordRequired?: boolean; cognitoUser?: CognitoUser }> {
  return new Promise((resolve) => {
    const pool = getUserPool();
    const cognitoUser = new CognitoUser({ Username: email, Pool: pool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: () => {
        resolve({ error: null });
      },
      onFailure: (err) => {
        resolve({ error: err.message || 'Sign in failed' });
      },
      newPasswordRequired: () => {
        resolve({ error: null, newPasswordRequired: true, cognitoUser });
      },
    });
  });
}

export function completeNewPassword(
  cognitoUser: CognitoUser,
  newPassword: string,
): Promise<{ error: string | null }> {
  return new Promise((resolve) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: () => {
        resolve({ error: null });
      },
      onFailure: (err) => {
        resolve({ error: err.message || 'Failed to set new password' });
      },
    });
  });
}

export function signOut(): Promise<void> {
  return new Promise((resolve) => {
    const pool = getUserPool();
    const cognitoUser = pool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    resolve();
  });
}
