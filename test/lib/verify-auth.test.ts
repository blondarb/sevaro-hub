import { describe, it, expect } from 'vitest';
import { verifyToken } from '@/lib/verify-auth';

describe('verifyToken', () => {
  it('returns null for empty token', async () => {
    const result = await verifyToken('');
    expect(result).toBeNull();
  });
});
