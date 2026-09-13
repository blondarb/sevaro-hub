import { readContext, resolveItem, snapshot } from './context.mjs';
import { page } from './page.mjs';
import { loadRuntimeSnapshot } from '../command-center/release.mjs';
import { readSnapshot } from '../command-center/context.mjs';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'"
};
function response(value, status = 200, type = 'application/json', extraHeaders = {}) {
  return new Response(type === 'application/json' ? JSON.stringify(value) : value,
    { status, headers: { ...headers, ...extraHeaders, 'Content-Type': type } });
}
export default {
  async fetch(request, env = {}) {
    // Trust these headers ONLY behind Sites dispatch, which authenticates visitors.
    // Do not expose this worker directly or forward these headers to a Hub backend.
    const viewer = request.headers.get('oai-authenticated-user-id');
    if (!viewer) {
      if (new URL(request.url).pathname === '/' && request.method === 'GET')
        return response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Sign in</title><h1>Sign in to your Command Center</h1><p><a href="/signin-with-chatgpt?return_to=%2F" target="_top">Continue with ChatGPT</a></p></html>', 401, 'text/html; charset=utf-8');
      return response({ error: 'authentication_required' }, 401);
    }
    if (request.method !== 'GET') return response({ error: 'read_only' }, 405);
    const url = new URL(request.url);
    // Owner-only Sites policy must be verified before operator setup. This
    // diagnostic returns only the authenticated visitor's own Site-scoped ID;
    // it never enrolls that visitor or exposes the snapshot without a binding.
    if (url.pathname === '/api/viewer' && !url.search && !env.PROOF_OWNER_SITE_USER_ID)
      return response({ site_user_id: viewer, binding_configured: false });
    if (!env.PROOF_OWNER_SITE_USER_ID)
      return response({ error: 'owner_binding_not_configured' }, 503);
    if (viewer !== env.PROOF_OWNER_SITE_USER_ID)
      return response({ error: 'owner_only' }, 403);
    if (url.pathname === '/api/viewer' && !url.search)
      return response({ site_user_id: viewer, binding_configured: true });
    // The authenticated shell remains usable when context expires. APIs still fail closed.
    if (url.pathname === '/proof.js') return response(env.PROOF_BROWSER_SOURCE ?? '', env.PROOF_BROWSER_SOURCE ? 200 : 503, 'text/javascript');
    // No body parsing, upload, action endpoint, request logging or external fetch.
    try {
      // Hosting adapters may represent removed settings as null or empty strings.
      // Fall back only when BOTH runtime fields are absent; partial/corrupt releases fail closed.
      const absent = value => value === undefined || value === null || value === '';
      const mode = env.CONTEXT_SOURCE_MODE;
      let current;
      if (mode === 'synthetic') current = snapshot;
      else if (mode === 'runtime') current = await loadRuntimeSnapshot(env);
      else if (mode === undefined && absent(env.CONTEXT_SNAPSHOT) && absent(env.CONTEXT_RELEASE_SHA256) && !Object.keys(env).some(k => k.startsWith('CONTEXT_SNAPSHOT_CHUNK_') && !absent(env[k]))) current = snapshot;
      else throw new Error('invalid_context_mode');
      if (url.pathname === '/api/status' && !url.search) return response({state:'ready',expires_at:current.expires_at});
      const pinnedRead = (snapshotId, viewId) => current === snapshot ? readContext(snapshotId, viewId) : readSnapshot(current, {snapshot_id:snapshotId,view_id:viewId});
      if (url.pathname === '/') {
        pinnedRead(current.snapshot_id, current.view_id);
        const markup = page.replace('__SNAPSHOT_ID__', current.snapshot_id).replace('__VIEW_ID__', current.view_id).replace('__CLASSIFICATION__', current.classification);
        return response(markup, 200, 'text/html; charset=utf-8');
      }
      if (url.pathname === '/api/context' || url.pathname === '/api/resolve') {
        const keys = [...url.searchParams.keys()];
        const allowed = ['snapshot_id','view_id'];
        if (url.pathname === '/api/resolve') {
          if (keys.includes('item_number')) allowed.push('item_number');
          else if (keys.includes('item_id')) allowed.push('item_id');
          else if (current === snapshot) allowed.push('phrase'); // legacy synthetic proof only
        }
        if (keys.length !== allowed.length || new Set(keys).size !== keys.length || keys.some(k => !allowed.includes(k)))
          return response({ error: 'invalid_parameters' }, 400);
        const args = Object.fromEntries(url.searchParams);
        const context = pinnedRead(args.snapshot_id, args.view_id);
        if (url.pathname === '/api/context') return response(context);
        if (args.phrase !== undefined && current === snapshot) return response(resolveItem(args));
        const number = args.item_number && /^(?:[1-9]\d?|100)$/.test(args.item_number) ? Number(args.item_number) : null;
        const found = context.items.find(i => args.item_id !== undefined ? i.item_id === args.item_id : i.number === number);
        return found ? response({snapshot_id:context.snapshot_id,view_id:context.view_id,item:found}) : response({error:'unknown_item'}, 400);
      }
      return response({ error: 'not_found' }, 404);
    } catch (error) {
      const reason = ['snapshot_expired','approval_expired','review_required','real_data_disabled','approval_required','release_not_approved','digest_mismatch','context_unavailable'].includes(error?.code) ? error.code : 'invalid_context';
      if (url.pathname === '/api/status' && !url.search) return response({state:'unavailable',reason},409);
      if (url.pathname === '/' && !url.search) {
        const shell = page.replace('__SNAPSHOT_ID__', 'unavailable').replace('__VIEW_ID__', 'unavailable').replace('__CLASSIFICATION__', 'unavailable').replace('</head>', '<meta name="context-failure" content="'+reason+'"></head>');
        return response(shell, 200, 'text/html; charset=utf-8', {'X-Context-State':'unavailable'});
      }
      return response({ error: 'context_unavailable_or_reference_invalid' }, 409);
    }
  }
};
