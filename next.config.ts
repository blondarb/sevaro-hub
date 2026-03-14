import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    FEEDBACK_API_URL: process.env.FEEDBACK_API_URL || 'https://8uagz9y5bh.execute-api.us-east-2.amazonaws.com/feedback',
  },
};

export default nextConfig;
