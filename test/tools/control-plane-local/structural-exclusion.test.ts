import { describe, expect, it } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
describe('production structural exclusion', () => {
  it('keeps the local dashboard outside Next routes and Amplify configuration', async () => {
    await expect(access(path.join(root, 'src/app/control-plane'))).rejects.toThrow();
    const amplify = await readFile(path.join(root, 'amplify.yml'), 'utf8');
    const next = await readFile(path.join(root, 'next.config.ts'), 'utf8');
    expect(amplify).not.toContain('control-plane-local'); expect(next).not.toContain('control-plane-local');
  });
});
