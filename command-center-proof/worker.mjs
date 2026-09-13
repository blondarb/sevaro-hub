import { readContext, resolveItem, snapshot } from './context.mjs';
import { page } from './page.mjs';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'"
};
function response(value, status = 200, type = 'application/json') {
  return new Response(type === 'application/json' ? JSON.stringify(value) : value,
    { status, headers: { ...headers, 'Content-Type': type } });
}
export default {
  async fetch(request, env = {}) {
    // Trust these headers ONLY behind Sites dispatch, which authenticates visitors.
    // Do not expose this worker directly or forward these headers to a Hub backend.
    const viewer = request.headers.get('oai-authenticated-user-id');
    if (!viewer) return response({ error: 'authentication_required' }, 401);
    if (!env.PROOF_OWNER_SITE_USER_ID)
      return response({ error: 'owner_binding_not_configured' }, 503);
    if (viewer !== env.PROOF_OWNER_SITE_USER_ID)
      return response({ error: 'owner_only' }, 403);
    if (request.method !== 'GET') return response({ error: 'read_only' }, 405);
    const url = new URL(request.url);
    // No body parsing, upload, action endpoint, request logging or external fetch.
    try {
      if (url.pathname === '/') {
        readContext(snapshot.snapshot_id, snapshot.view_id);
        return response(page, 200, 'text/html; charset=utf-8');
      }
      if (url.pathname === '/api/context' || url.pathname === '/api/resolve') {
        const allowed = url.pathname === '/api/context' ? ['snapshot_id', 'view_id'] : ['snapshot_id', 'view_id', 'phrase'];
        const keys = [...url.searchParams.keys()];
        if (keys.length !== allowed.length || new Set(keys).size !== keys.length || keys.some(k => !allowed.includes(k)))
          return response({ error: 'invalid_parameters' }, 400);
        const args = Object.fromEntries(url.searchParams);
        return response(url.pathname === '/api/context'
          ? readContext(args.snapshot_id, args.view_id) : resolveItem(args));
      }
      if (url.pathname === '/proof.js') return response(env.PROOF_BROWSER_SOURCE ?? '', env.PROOF_BROWSER_SOURCE ? 200 : 503, 'text/javascript');
      return response({ error: 'not_found' }, 404);
    } catch {
      return response({ error: 'context_unavailable_or_reference_invalid' }, 409);
    }
  }
};
