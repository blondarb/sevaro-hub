import type { NextConfig } from 'next';

// Why FEEDBACK_API_KEY is in the `env` block:
// Amplify branch env vars should be available via `process.env` at SSR runtime,
// but after the computeRoleArn reconfiguration on 2026-04-14 (Amplify build #82)
// runtime propagation broke for non-`NEXT_PUBLIC_` vars that weren't inlined at
// build time. `FEEDBACK_API_URL` was already here and kept working;
// `FEEDBACK_API_KEY` was not, so /api/feedback/sessions and
// /api/feedback/analyze both started 500ing because the Lambda received an
// empty x-api-key. Inlining it here forces build-time substitution.
//
// Security: verified that `FEEDBACK_API_URL` does NOT leak into client bundles
// (tree-shaking keeps server-only lib imports out of client chunks). The same
// applies to `FEEDBACK_API_KEY` as long as no client component imports
// `process.env.FEEDBACK_API_KEY` — do not do that.
const nextConfig: NextConfig = {
  env: {
    FEEDBACK_API_URL: process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback',
    FEEDBACK_API_KEY: process.env.FEEDBACK_API_KEY || '',
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
  },
};

export default nextConfig;
