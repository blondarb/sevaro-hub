/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Auto-cleanup DOM between component tests.
// RTL doesn't run cleanup automatically in vitest unless globals are enabled.
// Only runs in jsdom-environment files; skipped when `document` is undefined
// (which is the default `node` environment used for API route tests).
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});
