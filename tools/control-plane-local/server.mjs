/**
 * Local-only status dashboard for the Sevaro AI Control Plane.
 *
 * This deliberately sits outside Next.js and Amplify. It is an operator tool
 * that binds exclusively to loopback and never exposes its upstream address or
 * bearer credential to the browser.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(HERE, 'public');
const TIMEOUT_MS = 5_000;
const APPROVED_REPOSITORIES = new Set([
  'blondarb/sevaro-agent-memory',
  'blondarb/ai-setup-atlas',
  'blondarb/project-docs',
  'blondarb/sevaro-hub',
]);
export const CHECK_CODES = Object.freeze([
  'postgres_version',
  'read_only',
  'session_identity',
  'pool_identity',
  'role_safety',
  'principal_binding',
  'mcp_capabilities',
  'capability_roles',
  'gateway_execute',
  'read_surface',
  'protected_mutation',
  'schema_contract',
  'exact_four',
  'readable_exact_four',
  'deferred_repository_hidden',
]);
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/dashboard.css', ['dashboard.css', 'text/css; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'application/javascript; charset=utf-8']],
]);

function requestHostIsLoopback(host = '') {
  const value = host.toLowerCase();
  return /^(127\.0\.0\.1|localhost)(?::\d+)?$/.test(value) || /^\[::1\](?::\d+)?$/.test(value);
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isSafeCode(value) {
  return typeof value === 'string' && /^[a-z0-9_.-]{1,100}$/i.test(value);
}

export function loadConfig(env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('The local control-plane dashboard refuses NODE_ENV=production.');
  }
  if (env.CONTROL_PLANE_LOCAL_UI_ENABLED !== 'true') {
    throw new Error('Set CONTROL_PLANE_LOCAL_UI_ENABLED=true to start the local dashboard.');
  }
  if (env.CONTROL_PLANE_LOCAL_UI_HOST !== '127.0.0.1') {
    throw new Error('CONTROL_PLANE_LOCAL_UI_HOST must be exactly 127.0.0.1.');
  }
  const uiPort = Number(env.CONTROL_PLANE_LOCAL_UI_PORT);
  if (!Number.isInteger(uiPort) || uiPort < 1024 || uiPort > 65535) {
    throw new Error('CONTROL_PLANE_LOCAL_UI_PORT must be an integer from 1024 through 65535.');
  }
  if (!env.CONTROL_PLANE_LOCAL_API_URL) {
    throw new Error('CONTROL_PLANE_LOCAL_API_URL is required.');
  }
  if (!env.CONTROL_PLANE_LOCAL_API_BEARER || env.CONTROL_PLANE_LOCAL_API_BEARER.length < 32) {
    throw new Error('CONTROL_PLANE_LOCAL_API_BEARER must be at least 32 characters.');
  }

  let upstream;
  try {
    upstream = new URL(env.CONTROL_PLANE_LOCAL_API_URL);
  } catch {
    throw new Error('CONTROL_PLANE_LOCAL_API_URL must be a valid loopback HTTP URL.');
  }
  if (
    upstream.protocol !== 'http:' ||
    upstream.hostname !== '127.0.0.1' ||
    upstream.pathname !== '/v1/status' ||
    upstream.search || upstream.hash || upstream.username || upstream.password
  ) {
    throw new Error('CONTROL_PLANE_LOCAL_API_URL must be plain HTTP to 127.0.0.1/v1/status without credentials, query, or fragment.');
  }
  return Object.freeze({ uiHost: '127.0.0.1', uiPort, upstreamUrl: upstream.toString(), bearer: env.CONTROL_PLANE_LOCAL_API_BEARER });
}

/** Return only the documented public status shape; unknown upstream fields vanish. */
export function allowlistStatus(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const {
    schema_version, mode, readiness, checked_at, partition, permission_state,
    repository_count, repositories, tool_count, checks, boundaries,
  } = payload;
  if (
    schema_version !== '1' ||
    mode !== 'local_nonproduction' ||
    !['ready', 'blocked'].includes(readiness) ||
    !isIsoTimestamp(checked_at) ||
    partition !== 'product_development' ||
    !['current', 'refresh_required'].includes(permission_state) ||
    ![0, 4].includes(repository_count) ||
    tool_count !== 6 ||
    !Array.isArray(repositories) ||
    !Array.isArray(checks) ||
    checks.length !== 15 ||
    !boundaries || typeof boundaries !== 'object' || Array.isArray(boundaries)
  ) return null;

  if (repositories.length !== repository_count) return null;
  const safeRepositories = repositories.map((repository) => {
    if (!repository || typeof repository !== 'object' ||
      !APPROVED_REPOSITORIES.has(repository.full_name) ||
      !isIsoTimestamp(repository.retrieved_at)) return null;
    return { full_name: repository.full_name, retrieved_at: repository.retrieved_at };
  });
  if (safeRepositories.includes(null)) return null;
  if (repository_count === 4 && new Set(safeRepositories.map((item) => item.full_name)).size !== 4) return null;

  const safeChecks = checks.map((check, index) => {
    if (!check || typeof check !== 'object' || check.code !== CHECK_CODES[index] ||
      typeof check.passed !== 'boolean' || !isSafeCode(check.detail_code)) return null;
    return { code: check.code, passed: check.passed, detail_code: check.detail_code };
  });
  if (safeChecks.includes(null)) return null;

  const allChecksPassed = safeChecks.every((check) => check.passed);
  if (readiness === 'ready' &&
    (permission_state !== 'current' || repository_count !== 4 || !allChecksPassed)) return null;
  if (readiness === 'blocked' && repository_count !== 0) return null;
  if (permission_state === 'refresh_required' && allChecksPassed) return null;

  const expectedBoundaryKeys = ['content', 'phi', 'source_writes', 'canonical_data_writes', 'scheduling', 'remote_mcp', 'production'];
  if (expectedBoundaryKeys.some((key) => boundaries[key] !== false)) return null;
  if (boundaries.audit_logging !== true) return null;
  return {
    schema_version: '1', mode: 'local_nonproduction', readiness, checked_at,
    partition: 'product_development', permission_state, repository_count,
    repositories: safeRepositories, tool_count: 6, checks: safeChecks,
    boundaries: { ...Object.fromEntries(expectedBoundaryKeys.map((key) => [key, false])), audit_logging: true },
  };
}

function sameOriginStatusRequest(request) {
  if (request.headers['x-sevaro-local-status'] !== '1') return false;
  const fetchSite = request.headers['sec-fetch-site'];
  if (fetchSite && fetchSite !== 'same-origin') return false;
  const origin = request.headers.origin;
  if (origin && origin !== `http://${request.headers.host}`) return false;
  return true;
}

function respond(response, statusCode, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(statusCode, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
  });
  response.end(body);
}

function genericFailure(response) {
  respond(response, 502, JSON.stringify({ error: 'control_plane_status_unavailable' }));
}

async function fetchStatus(config, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetchImpl(config.upstreamUrl, {
      method: 'GET',
      headers: { authorization: `Bearer ${config.bearer}`, accept: 'application/json' },
      signal: controller.signal,
    });
    if (!upstream.ok) return null;
    return allowlistStatus(await upstream.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function createLocalDashboardServer({ config = loadConfig(), fetchImpl = fetch } = {}) {
  return createServer(async (request, response) => {
    if (!requestHostIsLoopback(request.headers.host)) {
      respond(response, 421, JSON.stringify({ error: 'loopback_host_required' }));
      return;
    }
    if (request.method !== 'GET') {
      respond(response, 405, JSON.stringify({ error: 'get_only' }));
      return;
    }
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === '/api/status') {
      if (!sameOriginStatusRequest(request)) {
        respond(response, 403, JSON.stringify({ error: 'same_origin_required' }));
        return;
      }
      const status = await fetchStatus(config, fetchImpl);
      if (!status) return genericFailure(response);
      respond(response, 200, JSON.stringify(status));
      return;
    }
    const staticFile = STATIC_FILES.get(pathname);
    if (!staticFile) {
      respond(response, 404, JSON.stringify({ error: 'not_found' }));
      return;
    }
    try {
      respond(response, 200, await readFile(path.join(PUBLIC_DIR, staticFile[0])), staticFile[1]);
    } catch {
      respond(response, 500, JSON.stringify({ error: 'dashboard_unavailable' }));
    }
  });
}

export function listenLocalDashboardServer(server, config) {
  return new Promise((resolve) => server.listen(config.uiPort, config.uiHost, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const server = createLocalDashboardServer({ config });
  listenLocalDashboardServer(server, config).then(() => {
    console.log(`Sevaro local control-plane dashboard: http://${config.uiHost}:${config.uiPort}`);
  });
}
