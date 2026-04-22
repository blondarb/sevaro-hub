import type { NextConfig } from 'next';

// SECURITY NOTE: do NOT add FEEDBACK_API_KEY, ADMIN_EMAILS, or any other
// server-only secret to the `env` block below. Values in `env` are inlined
// by Webpack's DefinePlugin into BOTH server and client bundles, leaking
// secrets to every browser. Previous commits (07a12f0, 93d222d) added these
// as a workaround for an Amplify SSR runtime-propagation issue — that bug is
// now fixed properly in `amplify.yml` by writing non-NEXT_PUBLIC_ branch
// env vars to `.env.production` at build time so Next.js loads them at
// SSR runtime without client-bundle exposure.
//
// `FEEDBACK_API_URL` is a public API Gateway URL (non-secret) and is left
// in the `env` block for backward compat; moving it is non-breaking but
// out of scope for the secret-leak fix.
const nextConfig: NextConfig = {
  env: {
    FEEDBACK_API_URL: process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback',
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
  },
};

export default nextConfig;
