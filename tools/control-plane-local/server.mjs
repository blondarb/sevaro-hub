/**
 * Local-only status dashboard for the Sevaro AI Control Plane.
 *
 * This deliberately sits outside Next.js and Amplify. It is an operator tool
 * that binds exclusively to loopback and never exposes its upstream address or
 * bearer credential to the browser.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(HERE, 'public');
const TIMEOUT_MS = 5_000;
// Schema v2 exposes exactly six repository tools, four Asana tools, and
// get_project_context_pack. Schema v3 adds the eleven durable
// project-intelligence tools in the Production v1 local read-only profile.
// The dashboard intentionally receives only counts, never tool names,
// arguments, or source content.
const EXACT_V2_TOOL_COUNT = 11;
const EXACT_V3_TOOL_COUNT = 22;
const EXACT_V4_TOOL_COUNT = 31;
const MAX_AUTHORIZED_REPOSITORIES = 500;
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
  'exact_asana_scope',
  'readable_exact_four',
  'deferred_repository_hidden',
  'context_pack_contract',
  'exact_project_link',
]);
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/dashboard.css', ['dashboard.css', 'text/css; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'application/javascript; charset=utf-8']],
]);

const STATUS_V2_KEYS = Object.freeze([
  'schema_version', 'mode', 'readiness', 'checked_at', 'partition',
  'github_scope', 'permission_state', 'asana_permission_state', 'repository_count',
  'repositories', 'asana_project_count', 'asana_projects', 'tool_count',
  'checks', 'boundaries',
]);
const STATUS_V3_KEYS = Object.freeze([
  ...STATUS_V2_KEYS,
  'active_project_count', 'stale_project_count', 'projects_without_owner_count',
]);
const STATUS_V4_KEYS = Object.freeze([...STATUS_V3_KEYS, 'capabilities']);
const CAPABILITY_KEYS = Object.freeze([
  'profile', 'base_read_tools', 'repository_text', 'shared_handoffs',
  'asana_actions', 'github_actions', 'automatic_metadata_refresh',
  'microsoft_graph', 'secret_delivery', 'phi', 'remote_mcp', 'production',
]);
const REPOSITORY_KEYS = Object.freeze(['full_name', 'retrieved_at']);
const ASANA_PROJECT_KEYS = Object.freeze(['name', 'status', 'retrieved_at']);
const CHECK_KEYS = Object.freeze(['code', 'passed', 'detail_code']);
const BOUNDARY_KEYS = Object.freeze([
  'content', 'phi', 'source_writes', 'canonical_data_writes', 'scheduling',
  'remote_mcp', 'production', 'audit_logging',
]);
const ACTION_PREVIEW_KEYS = Object.freeze([
  'preview_id', 'action', 'action_sha256', 'expires_at', 'proposer_consumers',
  'requires_explicit_user_confirmation', 'source_write_performed',
]);
const ACTION_RESULT_KEYS = Object.freeze([
  'operation_id', 'action', 'outcome', 'source_object_gid', 'source_write_performed',
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

function hasExactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isSafeMetadataText(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 250 && !/[\u0000-\u001f\u007f]/.test(value);
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isNumericGid(value) {
  return typeof value === 'string' && /^[0-9]{1,32}$/.test(value);
}

function hasOnlyKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function isSafeAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action) || !isNumericGid(action.workspace_gid)) return false;
  const common = ['action', 'workspace_gid'];
  const contentText = (value, maximum) => typeof value === 'string' && value.length > 0 &&
    value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value);
  if (action.action === 'create_task') return hasOnlyKeys(action, [...common, 'project_gid', 'name', 'assignee_gid', 'due_on', 'due_at', 'content_attested_phi_free']) && isNumericGid(action.project_gid) && contentText(action.name, 500) && action.content_attested_phi_free === true && (action.assignee_gid === undefined || isNumericGid(action.assignee_gid)) && (action.due_on === undefined || typeof action.due_on === 'string') && (action.due_at === undefined || isIsoTimestamp(action.due_at));
  if (action.action === 'update_task') return hasOnlyKeys(action, [...common, 'task_gid', 'name', 'due_on', 'due_at', 'content_attested_phi_free']) && isNumericGid(action.task_gid) && action.content_attested_phi_free === true && (action.name === undefined || contentText(action.name, 500)) && (action.due_on !== undefined || action.due_at !== undefined || action.name !== undefined) && (action.due_on === undefined || typeof action.due_on === 'string') && (action.due_at === undefined || isIsoTimestamp(action.due_at));
  if (action.action === 'complete_task') return hasExactKeys(action, [...common, 'task_gid']) && isNumericGid(action.task_gid);
  if (action.action === 'comment_task') return hasExactKeys(action, [...common, 'task_gid', 'text', 'content_attested_phi_free']) && isNumericGid(action.task_gid) && contentText(action.text, 2000) && action.content_attested_phi_free === true;
  if (action.action === 'assign_task') return hasExactKeys(action, [...common, 'task_gid', 'assignee_gid']) && isNumericGid(action.task_gid) && isNumericGid(action.assignee_gid);
  return false;
}

function safeCapabilities(value) {
  const expected = {
    profile: 'local_product_v1', base_read_tools: 22,
    repository_text: 'on_demand_permission_checked', shared_handoffs: 'canonical_postgresql',
    asana_actions: 'preview_then_local_confirmation', github_actions: 'not_implemented',
    automatic_metadata_refresh: 'foreground_session_only', microsoft_graph: 'not_connected',
    secret_delivery: 'broker_memory_only', phi: false, remote_mcp: false, production: false,
  };
  if (!hasExactKeys(value, CAPABILITY_KEYS)) return null;
  return CAPABILITY_KEYS.every((key) => value[key] === expected[key]) ? expected : null;
}

/**
 * GitHub owner/repository names are the only repository metadata this local
 * dashboard may publish. The upstream status service remains responsible for
 * determining authorization; this guard prevents content-shaped or malformed
 * values from crossing the local proxy.
 */
function isSafeGitHubFullName(value) {
  return typeof value === 'string' &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9._-]{1,100}$/.test(value);
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
  const isV2 = payload?.schema_version === '2';
  const isV3 = payload?.schema_version === '3';
  const isV4 = payload?.schema_version === '4';
  if ((!isV2 && !isV3 && !isV4) || !hasExactKeys(payload, isV4 ? STATUS_V4_KEYS : isV3 ? STATUS_V3_KEYS : STATUS_V2_KEYS)) return null;
  const {
    schema_version, mode, readiness, checked_at, partition, github_scope, permission_state,
    asana_permission_state, repository_count, repositories,
    asana_project_count, asana_projects, tool_count, checks, boundaries,
  } = payload;
  const projectIntelligence = (isV3 || isV4)
    ? {
      active_project_count: payload.active_project_count,
      stale_project_count: payload.stale_project_count,
      projects_without_owner_count: payload.projects_without_owner_count,
    }
    : null;
  if (
    (isV2 && tool_count !== EXACT_V2_TOOL_COUNT) ||
    (isV3 && tool_count !== EXACT_V3_TOOL_COUNT) ||
    (isV4 && tool_count !== EXACT_V4_TOOL_COUNT) ||
    mode !== 'local_nonproduction' ||
    !['exact_four', 'blondarb_estate'].includes(github_scope) ||
    !['ready', 'blocked'].includes(readiness) ||
    !isIsoTimestamp(checked_at) ||
    partition !== 'product_development' ||
    !['current', 'refresh_required'].includes(permission_state) ||
    !['current', 'refresh_required'].includes(asana_permission_state) ||
    !Number.isInteger(repository_count) || repository_count < 0 || repository_count > MAX_AUTHORIZED_REPOSITORIES ||
    !Number.isInteger(asana_project_count) || asana_project_count < 0 || asana_project_count > 100 ||
    !Array.isArray(repositories) ||
    !Array.isArray(asana_projects) ||
    !Array.isArray(checks) ||
    checks.length !== CHECK_CODES.length ||
    !boundaries || typeof boundaries !== 'object' || Array.isArray(boundaries)
  ) return null;

  if (projectIntelligence && (
    !Object.values(projectIntelligence).every((value) => Number.isInteger(value) && value >= 0 && value <= 100) ||
    projectIntelligence.active_project_count > asana_project_count ||
    projectIntelligence.stale_project_count > projectIntelligence.active_project_count ||
    projectIntelligence.projects_without_owner_count > projectIntelligence.active_project_count
  )) return null;

  if (repositories.length !== repository_count) return null;
  const safeRepositories = repositories.map((repository) => {
    if (!hasExactKeys(repository, REPOSITORY_KEYS) ||
      !isSafeGitHubFullName(repository.full_name) ||
      !isIsoTimestamp(repository.retrieved_at)) return null;
    return { full_name: repository.full_name, retrieved_at: repository.retrieved_at };
  });
  if (safeRepositories.includes(null)) return null;
  if (new Set(safeRepositories.map((item) => item.full_name)).size !== repository_count) return null;

  if (asana_projects.length !== asana_project_count) return null;
  const safeAsanaProjects = asana_projects.map((project) => {
    if (!hasExactKeys(project, ASANA_PROJECT_KEYS) ||
      !isSafeMetadataText(project.name) || !isSafeMetadataText(project.status) ||
      !isIsoTimestamp(project.retrieved_at)) return null;
    return { name: project.name, status: project.status, retrieved_at: project.retrieved_at };
  });
  if (safeAsanaProjects.includes(null)) return null;

  const safeChecks = checks.map((check, index) => {
    if (!hasExactKeys(check, CHECK_KEYS) || check.code !== CHECK_CODES[index] ||
      typeof check.passed !== 'boolean' || !isSafeCode(check.detail_code)) return null;
    return { code: check.code, passed: check.passed, detail_code: check.detail_code };
  });
  if (safeChecks.includes(null)) return null;

  const allChecksPassed = safeChecks.every((check) => check.passed);
  if (readiness === 'ready' &&
    (permission_state !== 'current' || asana_permission_state !== 'current' ||
      repository_count < 1 || asana_project_count < 1 || !allChecksPassed ||
      (github_scope === 'exact_four' && repository_count !== 4))) return null;
  if (readiness === 'blocked' &&
    (repository_count !== 0 || safeRepositories.length !== 0 ||
      asana_project_count !== 0 || safeAsanaProjects.length !== 0 ||
      (projectIntelligence && Object.values(projectIntelligence).some((value) => value !== 0)))) return null;
  if (readiness === 'blocked' && allChecksPassed &&
    permission_state === 'current' && asana_permission_state === 'current') return null;

  const expectedBoundaryKeys = ['content', 'phi', 'source_writes', 'canonical_data_writes', 'scheduling', 'remote_mcp', 'production'];
  if (!hasExactKeys(boundaries, BOUNDARY_KEYS)) return null;
  const expectedBoundaries = isV4
    ? { content: true, phi: false, source_writes: true, canonical_data_writes: true, scheduling: true, remote_mcp: false, production: false }
    : Object.fromEntries(expectedBoundaryKeys.map((key) => [key, false]));
  if (expectedBoundaryKeys.some((key) => boundaries[key] !== expectedBoundaries[key])) return null;
  if (boundaries.audit_logging !== true) return null;
  const capabilities = isV4 ? safeCapabilities(payload.capabilities) : null;
  if (isV4 && !capabilities) return null;
  return {
    schema_version, mode: 'local_nonproduction', readiness, checked_at,
    github_scope,
    partition: 'product_development', permission_state, asana_permission_state,
    repository_count, repositories: safeRepositories,
    asana_project_count, asana_projects: safeAsanaProjects,
    tool_count, checks: safeChecks,
    boundaries: { ...expectedBoundaries, audit_logging: true },
    ...(projectIntelligence ?? {}),
    ...(capabilities ? { capabilities } : {}),
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

function sameOriginActionRequest(request, { requireOrigin = false } = {}) {
  if (request.headers['x-sevaro-local-actions'] !== '1') return false;
  const fetchSite = request.headers['sec-fetch-site'];
  if (fetchSite && fetchSite !== 'same-origin') return false;
  const origin = request.headers.origin;
  if (requireOrigin && origin !== `http://${request.headers.host}`) return false;
  if (!requireOrigin && origin && origin !== `http://${request.headers.host}`) return false;
  return true;
}

function actionUrl(config) {
  const upstream = new URL(config.upstreamUrl);
  upstream.pathname = '/v1/actions';
  return upstream.toString();
}

function allowlistActions(payload) {
  if (!hasExactKeys(payload, ['previews']) || !Array.isArray(payload.previews) || payload.previews.length > 50) return null;
  const previews = payload.previews.map((preview) => {
    if (!hasExactKeys(preview, ACTION_PREVIEW_KEYS) ||
      !isUuid(preview.preview_id) || !Array.isArray(preview.proposer_consumers) ||
      preview.proposer_consumers.length < 1 || preview.proposer_consumers.length > 2 ||
      new Set(preview.proposer_consumers).size !== preview.proposer_consumers.length ||
      !preview.proposer_consumers.every((consumer) => ['codex', 'claude_code'].includes(consumer)) ||
      !isSafeAction(preview.action) || !isSafeCode(preview.action_sha256) ||
      !/^[0-9a-f]{64}$/.test(preview.action_sha256) || !isIsoTimestamp(preview.expires_at) ||
      preview.requires_explicit_user_confirmation !== true || preview.source_write_performed !== false) return null;
    return { preview_id: preview.preview_id, action: preview.action, action_sha256: preview.action_sha256, expires_at: preview.expires_at, proposer_consumers: preview.proposer_consumers, requires_explicit_user_confirmation: true, source_write_performed: false };
  });
  return previews.includes(null) ? null : { previews };
}

function allowlistActionResult(payload) {
  if (!hasExactKeys(payload, ACTION_RESULT_KEYS) || !isUuid(payload.operation_id) ||
    !['create_task', 'update_task', 'complete_task', 'comment_task', 'assign_task'].includes(payload.action) ||
    payload.outcome !== 'succeeded' || !isNumericGid(payload.source_object_gid) ||
    payload.source_write_performed !== true) return null;
  return { operation_id: payload.operation_id, action: payload.action, outcome: 'succeeded', source_object_gid: payload.source_object_gid, source_write_performed: true };
}

function validCsrfNonce(candidate, nonce) {
  if (typeof candidate !== 'string' || candidate.length !== nonce.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(nonce));
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

async function fetchActions(config, fetchImpl = fetch) {
  try {
    const upstream = await fetchImpl(actionUrl(config), {
      method: 'GET', headers: { authorization: `Bearer ${config.bearer}`, accept: 'application/json' },
    });
    if (!upstream.ok) return null;
    return allowlistActions(await upstream.json());
  } catch {
    return null;
  }
}

async function confirmAction(config, previewId, fetchImpl = fetch) {
  try {
    const upstream = await fetchImpl(`${actionUrl(config)}/${previewId}/confirm`, {
      method: 'POST', headers: { authorization: `Bearer ${config.bearer}`, accept: 'application/json', 'content-length': '0' },
    });
    if (!upstream.ok) {
      const body = await upstream.json().catch(() => null);
      return body?.detail === 'action_outcome_uncertain' || body?.error === 'action_outcome_uncertain'
        ? { uncertain: true } : null;
    }
    const result = allowlistActionResult(await upstream.json());
    return result ? { result } : null;
  } catch {
    return null;
  }
}

export function createLocalDashboardServer({ config = loadConfig(), fetchImpl = fetch } = {}) {
  const csrfNonce = randomBytes(32).toString('base64url');
  return createServer(async (request, response) => {
    if (!requestHostIsLoopback(request.headers.host)) {
      respond(response, 421, JSON.stringify({ error: 'loopback_host_required' }));
      return;
    }
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (request.method === 'GET' && pathname === '/api/actions') {
      if (!sameOriginActionRequest(request)) {
        respond(response, 403, JSON.stringify({ error: 'same_origin_required' }));
        return;
      }
      const actions = await fetchActions(config, fetchImpl);
      if (!actions) return genericFailure(response);
      respond(response, 200, JSON.stringify({ ...actions, csrf_nonce: csrfNonce }));
      return;
    }
    const confirmMatch = request.method === 'POST' && /^\/api\/actions\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/confirm$/i.exec(pathname);
    if (confirmMatch) {
      if (!sameOriginActionRequest(request, { requireOrigin: true }) || !validCsrfNonce(request.headers['x-control-plane-confirmation'], csrfNonce)) {
        respond(response, 403, JSON.stringify({ error: 'confirmation_denied' }));
        return;
      }
      let requestBytes = 0;
      for await (const chunk of request) {
        requestBytes += chunk.length;
        if (requestBytes > 0) {
          respond(response, 413, JSON.stringify({ error: 'confirmation_body_forbidden' }));
          return;
        }
      }
      const confirmed = await confirmAction(config, confirmMatch[1], fetchImpl);
      if (confirmed?.uncertain) {
        respond(response, 409, JSON.stringify({ error: 'action_outcome_uncertain' }));
        return;
      }
      if (!confirmed?.result) return genericFailure(response);
      respond(response, 200, JSON.stringify(confirmed.result));
      return;
    }
    if (request.method !== 'GET') {
      respond(response, 405, JSON.stringify({ error: 'get_only' }));
      return;
    }
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
