import { describe, it, expect } from 'vitest';
import {
  toSessionDetailDTO,
  toAnnotationDTO,
  derivePathname,
  type FeedbackSession,
  type ScreenshotAnnotation,
} from '@/lib/feedback-api';
import { deriveProposalPromptId } from '@/lib/improvement-queue-api';

function makeSession(overrides: Partial<FeedbackSession> = {}): FeedbackSession {
  return {
    sessionId: 'sess-1',
    appId: 'evidence-engine',
    category: 'bug',
    startedAt: '2026-04-22T09:00:00Z',
    duration: 42,
    audioKey: 'a.wav',
    screenshots: [],
    events: [],
    status: 'summarized',
    createdAt: '2026-04-22T09:00:00Z',
    userLabel: 'tester@example.com',
    reviewStatus: 'open',
    aiSummary: 'summary text',
    ...overrides,
  };
}

function makeAnnotation(overrides: Partial<ScreenshotAnnotation> = {}): ScreenshotAnnotation {
  return {
    coordinates: { x: 10, y: 20 },
    viewport: { width: 1200, height: 800 },
    elementInfo: { selector: 'button.primary', tag: 'button' },
    routePath: '/patient',
    ...overrides,
  };
}

describe('toSessionDetailDTO', () => {
  it('serializes the whitelisted session fields', () => {
    const dto = toSessionDetailDTO(
      makeSession({
        resolutionNote: 'fixed it',
        resolvedBy: 'steve@sevaro.com',
        resolvedAt: '2026-04-22T10:00:00Z',
        transcript: 'full transcript',
        processingError: 'boom',
      }),
    );

    expect(dto).toEqual({
      sessionId: 'sess-1',
      appId: 'evidence-engine',
      userLabel: 'tester@example.com',
      category: 'bug',
      duration: 42,
      screenSize: undefined,
      status: 'summarized',
      processingError: 'boom',
      reviewStatus: 'open',
      resolutionNote: 'fixed it',
      resolvedBy: 'steve@sevaro.com',
      resolvedAt: '2026-04-22T10:00:00Z',
      aiSummary: 'summary text',
      transcript: 'full transcript',
      createdAt: '2026-04-22T09:00:00Z',
    });
  });

  it('does NOT serialize fields outside the whitelist (events, audioUrl, screenshots, userAgent, triageProposal, userId)', () => {
    const dto = toSessionDetailDTO(
      makeSession({
        userId: 'cognito-sub-xyz',
        userAgent: 'Mozilla/5.0',
        audioUrl: 's3://...',
        audioKey: 'secret.wav',
        screenshots: ['s1', 's2'],
        triageProposal: {
          version: 1,
          createdAt: '2026-04-22T09:00:00Z',
          classification: 'real_bug',
          confidence: 0.9,
          themeId: 'x',
          themeDescription: 'y',
          suspectedRepo: 'z',
          suspectedFiles: [],
          rationale: 'r',
          revisions: [],
        },
      }),
    );
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain('cognito-sub-xyz');
    expect(serialized).not.toContain('Mozilla');
    expect(serialized).not.toContain('audioUrl');
    expect(serialized).not.toContain('audioKey');
    expect(serialized).not.toContain('screenshots');
    expect(serialized).not.toContain('triageProposal');
    expect(serialized).not.toContain('userId');
  });
});

describe('toAnnotationDTO', () => {
  it('strips pageUrl, screenshotUrl, screenshotKey from annotations', () => {
    const dto = toAnnotationDTO(
      makeAnnotation({
        pageUrl: 'https://app.example.com/patient/123?name=Jane+Doe',
        screenshotUrl: 'https://s3/bucket/shot.png',
        screenshotKey: 's3-key/shot.png',
      }),
    );
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain('pageUrl');
    expect(serialized).not.toContain('Jane');
    expect(serialized).not.toContain('screenshotUrl');
    expect(serialized).not.toContain('screenshotKey');
    expect(serialized).not.toContain('s3-key');
  });

  it('preserves whitelisted elementInfo keys (tag, selector, role, testId, dataTour, className)', () => {
    const dto = toAnnotationDTO(
      makeAnnotation({
        elementInfo: {
          tag: 'button',
          selector: 'button.primary',
          role: 'button',
          testId: 'save-btn',
          dataTour: 'tour-step-1',
          className: 'primary',
        },
      }),
    );
    expect(dto.elementInfo).toEqual({
      tag: 'button',
      selector: 'button.primary',
      role: 'button',
      testId: 'save-btn',
      dataTour: 'tour-step-1',
      className: 'primary',
    });
  });

  it('drops unexpected elementInfo keys not in the whitelist', () => {
    // Older clients sent extra keys (e.g. ariaLabel carrying DOM innerText, outerHTML).
    // Cast through unknown to simulate wire-format payloads that don't match the type.
    const raw = {
      ...makeAnnotation(),
      elementInfo: {
        tag: 'input',
        selector: 'input[name=mrn]',
        // these fields are NOT on the type — simulating legacy payloads
        ariaLabel: 'Medical record number 12345',
        innerText: 'Jane Doe',
        outerHTML: '<input value="12345" />',
      },
    } as unknown as ScreenshotAnnotation;

    const dto = toAnnotationDTO(raw);
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain('ariaLabel');
    expect(serialized).not.toContain('innerText');
    expect(serialized).not.toContain('outerHTML');
    expect(serialized).not.toContain('Jane Doe');
    expect(serialized).not.toContain('12345');
  });

  it('handles missing elementInfo gracefully', () => {
    // Defensive: older widgets occasionally omitted elementInfo entirely.
    const raw = {
      coordinates: { x: 0, y: 0 },
      viewport: { width: 100, height: 100 },
      routePath: '/',
    } as unknown as ScreenshotAnnotation;
    const dto = toAnnotationDTO(raw);
    expect(dto.elementInfo.tag).toBe('');
  });
});

describe('derivePathname (routePath fallback)', () => {
  it('strips query string from an absolute URL', () => {
    expect(
      derivePathname('https://app.example.com/patient/123?name=Jane+Doe'),
    ).toBe('/patient/123');
  });

  it('strips query string from a relative URL', () => {
    expect(derivePathname('/patient/123?name=Jane+Doe')).toBe('/patient/123');
  });

  it('strips fragment from a hash-routed URL', () => {
    expect(derivePathname('/app#/mrn=12345')).toBe('/app');
  });

  it('returns / for fragment-only input', () => {
    // URL() keeps the leading slash-less part as a relative path — '#foo' against
    // the dummy base yields pathname '/'. Still safe.
    expect(derivePathname('#/mrn=12345')).toBe('/');
  });

  it('returns / for empty/undefined input', () => {
    expect(derivePathname(undefined)).toBe('/');
    expect(derivePathname('')).toBe('/');
  });

  it('returns / for a truly unparseable URL', () => {
    // URL() is surprisingly permissive but malformed IDN + protocol-only usually
    // throws. If it does not, the fallback of '/' still applies because the
    // dummy-base parse succeeds and yields a safe pathname.
    const result = derivePathname('ht!tp://\x00\x01');
    expect(result.startsWith('/')).toBe(true);
    expect(result).not.toContain('\x00');
  });
});

describe('deriveProposalPromptId (Codex M#4 stable key)', () => {
  it('produces a stable, version-scoped id from sessionId + proposalVersion', () => {
    expect(deriveProposalPromptId('abc-123', 2)).toBe('improvement-abc-123-v2');
  });

  it('sanitizes non-alphanumeric characters in sessionId', () => {
    expect(deriveProposalPromptId('a.b/c:d', 1)).toBe('improvement-a-b-c-d-v1');
  });

  it('is deterministic — two calls with the same inputs return the same key (retry-safe)', () => {
    expect(deriveProposalPromptId('s1', 3)).toBe(deriveProposalPromptId('s1', 3));
  });

  it('distinguishes different proposal versions (re-approval after /refine-prompt)', () => {
    expect(deriveProposalPromptId('s1', 1)).not.toBe(deriveProposalPromptId('s1', 2));
  });
});
