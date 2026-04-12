# Sevaro Hub — Stack

## Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^15.5.0 | App Router SSR framework |
| react / react-dom | ^19.0.0 | UI library |
| @aws-sdk/client-bedrock-runtime | ^3.1009.0 | Bedrock Sonnet (feedback pattern analysis) |
| @aws-sdk/client-ses | ^3.1009.0 | SES email notifications |
| jose | ^6.2.1 | JWT verification (Cognito JWKS) |

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| typescript ^5.7.0 | Type checking |
| @types/node, @types/react, @types/react-dom | Type definitions |

Note: No shadcn/ui or Tailwind listed in package.json — styling approach is minimal/custom.

## Key Infrastructure

| Resource | ID / Value |
|----------|-----------|
| Hosting | AWS Amplify `d3n3e9vr1knkam` |
| Production domain | `hub.neuroplans.app` |
| Deploy | Auto-deploy on push to `main` |
| Cognito User Pool | `us-east-2_Owfb1zpgM` (shared pool, legacy) |
| Cognito App Client | `7t8bjj2fjkvtu081qhledc627a` |
| IAM Role | `SevaroHub-AmplifySSR` (SES, Bedrock, SSM permissions) |
| SES | From: `feedback@neuroplans.app` (DKIM verified; sandbox mode) |
| Feedback Lambda | `sevaro-feedback-api` via API Gateway `8uagz9y5bh` |
| What's New Lambda | `sevaro-whats-new-api` via API Gateway `5168ofhh8k` |
| What's New DynamoDB | `sevaro-whats-new` (PK: `appId`, SK: `timestamp`) |
| Improvement Queue Lambda | `sevaro-improvement-queue-api` via API Gateway `ael0orzmsk` |
| Improvement Queue DynamoDB | `sevaro-improvement-queue` (PK: `repoName`, SK: `promptId`) |
| Admin access control | `ADMIN_EMAILS` env var |
| AWS Region | `us-east-2` |

## Dev Commands

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Production build
pnpm start        # Start production server

# AWS
aws sso login --profile sevaro-sandbox
```
