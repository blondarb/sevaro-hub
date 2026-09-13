// Loopback-only synthetic preview. This is NOT hosted authentication evidence.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import worker from './worker.mjs';
const browser = await readFile(new URL('./browser.mjs', import.meta.url), 'utf8');
http.createServer(async (incoming, outgoing) => {
  try {
    const request = new Request('http://127.0.0.1:3047' + incoming.url, {
      method: incoming.method, headers: { 'oai-authenticated-user-id': 'synthetic-local-owner' }
    });
    const result = await worker.fetch(request, {
      PROOF_OWNER_SITE_USER_ID: 'synthetic-local-owner', PROOF_BROWSER_SOURCE: browser
    });
    outgoing.writeHead(result.status, Object.fromEntries(result.headers));
    let body = await result.text();
    if (result.headers.get('Content-Type').startsWith('text/html'))
      body = body.replace('<body>', '<body><p><strong>Local simulation — hosted authentication and Voice are not verified.</strong></p>');
    outgoing.end(body);
  } catch { outgoing.writeHead(500); outgoing.end('preview_unavailable'); }
}).listen(3047, '127.0.0.1', () => console.log('Local synthetic preview: http://127.0.0.1:3047'));
