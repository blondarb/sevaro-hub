import { afterEach, describe, expect, it } from 'vitest';
import { CHECK_CODES, createLocalDashboardServer, allowlistStatus, listenLocalDashboardServer, loadConfig } from '../../../tools/control-plane-local/server.mjs';
import { request as httpRequest } from 'node:http';

const upstream = 'http://127.0.0.1:9999/v1/status';
const config = { uiHost: '127.0.0.1' as const, uiPort: 43123, upstreamUrl: upstream, bearer: 'test-bearer' };
const approved = ['blondarb/sevaro-agent-memory', 'blondarb/ai-setup-atlas', 'blondarb/project-docs', 'blondarb/sevaro-hub'];
const status = () => ({ schema_version: '2', mode: 'local_nonproduction', readiness: 'ready', checked_at: '2026-08-06T12:00:00Z', partition: 'product_development', github_scope: 'exact_four', permission_state: 'current', asana_permission_state: 'current', repository_count: 4, repositories: approved.map((full_name) => ({ full_name, retrieved_at: '2026-08-06T11:00:00Z' })), asana_project_count: 2, asana_projects: [{ name: 'Portfolio', status: 'on_track', retrieved_at: '2026-08-06T11:00:00Z' }, { name: 'Team Ops', status: 'at_risk', retrieved_at: '2026-08-06T11:00:00Z' }], tool_count: 11, checks: CHECK_CODES.map((code) => ({ code, passed: true, detail_code: 'passed' })), boundaries: { content: false, phi: false, source_writes: false, canonical_data_writes: false, scheduling: false, remote_mcp: false, production: false, audit_logging: true } });
const broadStatus = () => ({ ...status(), schema_version: '3', github_scope: 'blondarb_estate', tool_count: 22, active_project_count: 2, stale_project_count: 1, projects_without_owner_count: 0 });
const productStatus = () => ({ ...broadStatus(), schema_version: '4', tool_count: 31, boundaries: { content: true, phi: false, source_writes: true, canonical_data_writes: true, scheduling: true, remote_mcp: false, production: false, audit_logging: true }, capabilities: { profile: 'local_product_v1', base_read_tools: 22, repository_text: 'on_demand_permission_checked', shared_handoffs: 'canonical_postgresql', asana_actions: 'preview_then_local_confirmation', github_actions: 'not_implemented', automatic_metadata_refresh: 'foreground_session_only', microsoft_graph: 'not_connected', secret_delivery: 'broker_memory_only', phi: false, remote_mcp: false, production: false } });
const actionPreview = { proposer_consumers: ['codex', 'claude_code'], preview_id: '123e4567-e89b-42d3-a456-426614174000', action: { action: 'complete_task', workspace_gid: '1202528578803653', task_gid: '55' }, action_sha256: 'a'.repeat(64), expires_at: '2026-09-04T12:05:00Z', requires_explicit_user_confirmation: true, source_write_performed: false };
const servers: import('node:http').Server[] = [];

async function start(options: Parameters<typeof createLocalDashboardServer>[0]) {
  const server = createLocalDashboardServer(options); servers.push(server); await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as import('node:net').AddressInfo; return `http://127.0.0.1:${port}`;
}
async function requestWithHost(url: string, host: string) {
  return new Promise<number>((resolve, reject) => {
    const target = new URL(url);
    const request = httpRequest({ hostname: target.hostname, port: target.port, path: target.pathname, headers: { host } }, (response) => {
      response.resume(); response.on('end', () => resolve(response.statusCode ?? 0));
    });
    request.on('error', reject); request.end();
  });
}
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

describe('local dashboard configuration', () => {
  const validEnvironment: NodeJS.ProcessEnv = { NODE_ENV: 'test', CONTROL_PLANE_LOCAL_UI_ENABLED: 'true', CONTROL_PLANE_LOCAL_UI_HOST: '127.0.0.1', CONTROL_PLANE_LOCAL_UI_PORT: '43123', CONTROL_PLANE_LOCAL_API_URL: upstream, CONTROL_PLANE_LOCAL_API_BEARER: 'x'.repeat(32) };
  it('requires explicit fixed loopback UI configuration', () => {
    expect(loadConfig(validEnvironment)).toMatchObject({ uiHost: '127.0.0.1', uiPort: 43123, upstreamUrl: upstream });
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow('CONTROL_PLANE_LOCAL_UI_ENABLED');
    expect(() => loadConfig({ ...validEnvironment, NODE_ENV: 'production' })).toThrow('refuses NODE_ENV=production');
    expect(() => loadConfig({ ...validEnvironment, CONTROL_PLANE_LOCAL_UI_HOST: 'localhost' })).toThrow('exactly 127.0.0.1');
    expect(() => loadConfig({ ...validEnvironment, CONTROL_PLANE_LOCAL_UI_PORT: '0' })).toThrow('1024 through 65535');
    expect(() => loadConfig({ ...validEnvironment, CONTROL_PLANE_LOCAL_API_BEARER: 'short' })).toThrow('at least 32 characters');
  });
  it('requires a plain fixed loopback status endpoint', () => {
    for (const CONTROL_PLANE_LOCAL_API_URL of ['https://127.0.0.1:9999/v1/status', 'http://localhost:9999/v1/status', 'http://127.0.0.1:9999/other', 'http://user:pass@127.0.0.1:9999/v1/status', 'http://127.0.0.1:9999/v1/status?x=1', 'http://127.0.0.1:9999/v1/status#fragment']) {
      expect(() => loadConfig({ ...validEnvironment, CONTROL_PLANE_LOCAL_API_URL })).toThrow('plain HTTP');
    }
  });
  it('listens only on the configured host and port', async () => {
    const calls: unknown[] = [];
    const server = { listen: (...args: unknown[]) => { calls.push(args); const callback = args.at(-1); if (typeof callback === 'function') callback(); return server; } };
    await listenLocalDashboardServer(server, { ...config, uiHost: '127.0.0.1', uiPort: 43123 });
    expect(calls).toEqual([[43123, '127.0.0.1', expect.any(Function)]]);
  });
});

describe('status allowlisting', () => {
  it('reconstructs only the documented public response', () => {
    const safe = allowlistStatus(status());
    expect(safe).toMatchObject({ schema_version: '2', github_scope: 'exact_four', tool_count: 11, repository_count: 4, asana_project_count: 2 });
    expect(safe?.checks).toHaveLength(18);
    expect(JSON.stringify(safe)).not.toContain('secret');
    expect(JSON.stringify(safe)).not.toContain('test-bearer');
  });
  it('accepts only the exact schema-v3/project-intelligence contract', () => {
    const safe = allowlistStatus(broadStatus());
    expect(safe).toMatchObject({ schema_version: '3', github_scope: 'blondarb_estate', tool_count: 22, active_project_count: 2, stale_project_count: 1, projects_without_owner_count: 0 });
    expect(Object.keys(safe ?? {}).sort()).toEqual(Object.keys(broadStatus()).sort());

    const v3WrongToolCount = broadStatus(); v3WrongToolCount.tool_count = 16;
    expect(allowlistStatus(v3WrongToolCount)).toBeNull();
    const v2UnexpectedAggregate = { ...status(), active_project_count: 1 };
    expect(allowlistStatus(v2UnexpectedAggregate)).toBeNull();
    const excessiveAggregate = broadStatus(); excessiveAggregate.stale_project_count = 3;
    expect(allowlistStatus(excessiveAggregate)).toBeNull();
    const blockedWithAggregate = broadStatus(); blockedWithAggregate.readiness = 'blocked'; blockedWithAggregate.permission_state = 'refresh_required'; blockedWithAggregate.asana_permission_state = 'refresh_required'; blockedWithAggregate.repository_count = 0; blockedWithAggregate.repositories = []; blockedWithAggregate.asana_project_count = 0; blockedWithAggregate.asana_projects = [];
    expect(allowlistStatus(blockedWithAggregate)).toBeNull();
  });
  it('accepts schema-v4 only with exact local-product capabilities and boundaries', () => {
    expect(allowlistStatus(productStatus())).toMatchObject({ schema_version: '4', tool_count: 31, capabilities: { asana_actions: 'preview_then_local_confirmation' }, boundaries: { source_writes: true, phi: false } });
    const wrongCapabilities = productStatus(); wrongCapabilities.capabilities.github_actions = 'enabled'; expect(allowlistStatus(wrongCapabilities)).toBeNull();
    const wrongBoundary = productStatus(); wrongBoundary.boundaries.scheduling = false; expect(allowlistStatus(wrongBoundary)).toBeNull();
    const wrongCount = productStatus(); wrongCount.tool_count = 22; expect(allowlistStatus(wrongCount)).toBeNull();
  });
  it('accepts bounded, metadata-only authorized repository estates and rejects malformed entries', () => {
    const estate = status(); estate.github_scope = 'blondarb_estate'; estate.repository_count = 5; estate.repositories = [...estate.repositories, { full_name: 'sevaro-labs/control-plane', retrieved_at: '2026-08-06T11:00:00Z' }];
    expect(allowlistStatus(estate)).toMatchObject({ repository_count: 5 });
    const wrongExactScope = status(); wrongExactScope.github_scope = 'exact_four'; wrongExactScope.repository_count = 5; wrongExactScope.repositories = estate.repositories;
    expect(allowlistStatus(wrongExactScope)).toBeNull();
    const duplicateRepository = status(); duplicateRepository.repositories[3].full_name = duplicateRepository.repositories[0].full_name;
    expect(allowlistStatus(duplicateRepository)).toBeNull();
    const badRepository = status(); badRepository.repositories[0].full_name = 'unapproved/private/content';
    expect(allowlistStatus(badRepository)).toBeNull();
    const excessiveRepositoryCount = status(); excessiveRepositoryCount.repository_count = 501;
    expect(allowlistStatus(excessiveRepositoryCount)).toBeNull();
    const unsafeBoundary = status(); unsafeBoundary.boundaries.source_writes = true;
    expect(allowlistStatus(unsafeBoundary)).toBeNull();
    for (const tool_count of [8, 10, 12, 16, 22]) {
      const driftedToolCount = status(); driftedToolCount.tool_count = tool_count;
      expect(allowlistStatus(driftedToolCount)).toBeNull();
    }
    const legacyCheckSet = status(); legacyCheckSet.checks = legacyCheckSet.checks.slice(0, 16);
    expect(allowlistStatus(legacyCheckSet)).toBeNull();
  });
  it('rejects inconsistent readiness, Asana, and permission states', () => {
    const blockedWithRows = status(); blockedWithRows.readiness = 'blocked';
    expect(allowlistStatus(blockedWithRows)).toBeNull();
    const readyWithFailedCheck = status(); readyWithFailedCheck.checks[0].passed = false;
    expect(allowlistStatus(readyWithFailedCheck)).toBeNull();
    const refreshWithPassingChecks = status(); refreshWithPassingChecks.readiness = 'blocked'; refreshWithPassingChecks.permission_state = 'refresh_required'; refreshWithPassingChecks.repository_count = 0; refreshWithPassingChecks.repositories = []; refreshWithPassingChecks.asana_project_count = 0; refreshWithPassingChecks.asana_projects = [];
    expect(allowlistStatus(refreshWithPassingChecks)).not.toBeNull();
    const readyWithStaleAsana = status(); readyWithStaleAsana.asana_permission_state = 'refresh_required';
    expect(allowlistStatus(readyWithStaleAsana)).toBeNull();
    const duplicateChecks = status(); duplicateChecks.checks[1].code = duplicateChecks.checks[0].code;
    expect(allowlistStatus(duplicateChecks)).toBeNull();
  });
  it('rejects extra or malformed fields at every published layer', () => {
    const extraTopLevel = { ...status(), unexpected: 'source-detail' };
    expect(allowlistStatus(extraTopLevel)).toBeNull();
    const extraRepository: any = status(); extraRepository.repositories[0].unexpected = 'source-detail';
    expect(allowlistStatus(extraRepository)).toBeNull();
    const extraProject: any = status(); extraProject.asana_projects[0].description = 'excluded content';
    expect(allowlistStatus(extraProject)).toBeNull();
    const extraCheck: any = status(); extraCheck.checks[0].internal = 'private';
    expect(allowlistStatus(extraCheck)).toBeNull();
    const extraBoundary: any = status(); extraBoundary.boundaries.unexpected = false;
    expect(allowlistStatus(extraBoundary)).toBeNull();
    const invalidProjectCount = status(); invalidProjectCount.asana_project_count = 3;
    expect(allowlistStatus(invalidProjectCount)).toBeNull();
    const excessiveProjectCount = status(); excessiveProjectCount.asana_project_count = 101;
    expect(allowlistStatus(excessiveProjectCount)).toBeNull();
  });
});

describe('local HTTP guards', () => {
  it('preserves FastAPI uncertain outcomes without retrying the upstream write', async () => {
    let writes = 0;
    const base = await start({ config, fetchImpl: async (url) => {
      if (String(url).endsWith('/v1/actions')) return new Response(JSON.stringify({ previews: [actionPreview] }));
      writes += 1;
      return new Response(JSON.stringify({ detail: 'action_outcome_uncertain' }), { status: 409 });
    } });
    const payload = await (await fetch(`${base}/api/actions`, { headers: { 'x-sevaro-local-actions': '1' } })).json();
    const result = await fetch(`${base}/api/actions/${actionPreview.preview_id}/confirm`, {
      method: 'POST', headers: { 'x-sevaro-local-actions': '1', origin: base, 'x-control-plane-confirmation': payload.csrf_nonce },
    });
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: 'action_outcome_uncertain' });
    expect(writes).toBe(1);
  });
  it('allows GET status, but not upstream details', async () => {
    const received: { url?: string; auth?: string } = {};
    const base = await start({ config, fetchImpl: async (url, init) => { received.url = String(url); received.auth = new Headers(init?.headers).get('authorization') ?? undefined; return new Response(JSON.stringify(status()), { status: 200 }); } });
    const response = await fetch(`${base}/api/status`, { headers: { 'x-sevaro-local-status': '1' } }); const body = await response.text();
    expect(response.status).toBe(200); expect(received.url).toBe(upstream); expect(received.auth).toBe('Bearer test-bearer');
    expect(response.headers.get('content-security-policy')).toContain("connect-src 'self'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff'); expect(response.headers.get('referrer-policy')).toBe('no-referrer'); expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(body).not.toContain('test-bearer'); expect(body).not.toContain('upstream_secret');
  });
  it('rejects non-GET and non-loopback Host headers', async () => {
    const base = await start({ config, fetchImpl: async () => new Response(JSON.stringify(status())) });
    const post = await fetch(`${base}/api/status`, { method: 'POST' }); expect(post.status).toBe(405); expect(post.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(await requestWithHost(`${base}/api/status`, 'evil.example')).toBe(421);
  });
  it('rejects cross-origin or unmarked browser requests before the upstream read', async () => {
    let calls = 0;
    const base = await start({ config, fetchImpl: async () => { calls += 1; return new Response(JSON.stringify(status())); } });
    const unmarked = await fetch(`${base}/api/status`);
    const crossSite = await fetch(`${base}/api/status`, { headers: { 'x-sevaro-local-status': '1', 'sec-fetch-site': 'cross-site' } });
    const foreignOrigin = await fetch(`${base}/api/status`, { headers: { 'x-sevaro-local-status': '1', origin: 'https://evil.example' } });
    expect(unmarked.status).toBe(403); expect(crossSite.status).toBe(403); expect(foreignOrigin.status).toBe(403); expect(calls).toBe(0);
  });
  it('returns generic upstream failures', async () => {
    const base = await start({ config, fetchImpl: async () => { throw new Error('private failure'); } });
    const response = await fetch(`${base}/api/status`, { headers: { 'x-sevaro-local-status': '1' } }); const body = await response.text();
    expect(response.status).toBe(502); expect(body).toBe('{"error":"control_plane_status_unavailable"}');
    expect(body).not.toContain('private failure');
  });
  it('proxies only safe action previews and requires same-origin nonce confirmation', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const base = await start({ config, fetchImpl: async (url, init) => { calls.push({ url: String(url), init }); if (String(url).endsWith('/v1/actions')) return new Response(JSON.stringify({ previews: [actionPreview] })); return new Response(JSON.stringify({ operation_id: '123e4567-e89b-42d3-a456-426614174001', action: 'complete_task', outcome: 'succeeded', source_object_gid: '55', source_write_performed: true })); } });
    const actions = await fetch(`${base}/api/actions`, { headers: { 'x-sevaro-local-actions': '1' } }); const payload = await actions.json();
    expect(actions.status).toBe(200); expect(payload.previews[0]).not.toHaveProperty('confirmation_token'); expect(payload.csrf_nonce).toHaveLength(43); expect(calls[0].url).toBe('http://127.0.0.1:9999/v1/actions');
    const denied = await fetch(`${base}/api/actions/${actionPreview.preview_id}/confirm`, { method: 'POST', headers: { 'x-sevaro-local-actions': '1', origin: base } }); expect(denied.status).toBe(403);
    const confirmed = await fetch(`${base}/api/actions/${actionPreview.preview_id}/confirm`, { method: 'POST', headers: { 'x-sevaro-local-actions': '1', origin: base, 'x-control-plane-confirmation': payload.csrf_nonce } }); expect(confirmed.status).toBe(200); expect(calls[1].url).toBe(`http://127.0.0.1:9999/v1/actions/${actionPreview.preview_id}/confirm`); expect(new Headers(calls[1].init?.headers).get('authorization')).toBe('Bearer test-bearer'); expect(JSON.stringify(await confirmed.json())).not.toContain('test-bearer');
  });
  it('rejects action injection, foreign origins, bodies, and redacts upstream errors', async () => {
    let calls = 0; const base = await start({ config, fetchImpl: async () => { calls += 1; return new Response(JSON.stringify({ previews: [{ ...actionPreview, action: { ...actionPreview.action, unexpected: '<img>' } }] })); } });
    const foreign = await fetch(`${base}/api/actions`, { headers: { 'x-sevaro-local-actions': '1', origin: 'https://evil.example' } }); expect(foreign.status).toBe(403);
    const malformed = await fetch(`${base}/api/actions`, { headers: { 'x-sevaro-local-actions': '1' } }); expect(malformed.status).toBe(502); expect(await malformed.text()).not.toContain('img');
    expect(calls).toBe(1);
  });
});
