// Loopback-only fictional approval simulation; never hosted authentication evidence.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import worker from './worker.mjs';
import { database, synthetic } from './testing/synthetic.mjs';
const { env } = await synthetic();
env.DB = await database();
env.PROOF_BROWSER_SOURCE = await readFile(
  new URL('browser.mjs', import.meta.url),
  'utf8',
);
env.APPROVAL_BROWSER_SOURCE = await readFile(
  new URL('approvals-browser.mjs', import.meta.url),
  'utf8',
);
const port = 3048,
  origin = 'http://127.0.0.1:' + port;
http
  .createServer(async (incoming, outgoing) => {
    try {
      // Reject DNS rebinding; the identity shim exists only in this synthetic preview.
      if (incoming.headers.host !== '127.0.0.1:' + port) {
        outgoing.writeHead(403);
        outgoing.end();
        return;
      }
      const headers = new Headers({
        'oai-authenticated-user-id': 'synthetic-owner',
      });
      for (const key of [
        'origin',
        'content-type',
        'x-command-approval',
        'sec-fetch-site',
      ])
        if (incoming.headers[key]) headers.set(key, incoming.headers[key]);
      const method = incoming.method,
        request = new Request(origin + incoming.url, {
          method,
          headers,
          ...(['GET', 'HEAD'].includes(method)
            ? {}
            : { body: incoming, duplex: 'half' }),
        });
      const result = await worker.fetch(request, env);
      outgoing.writeHead(result.status, Object.fromEntries(result.headers));
      let body = await result.text();
      if (result.headers.get('content-type')?.startsWith('text/html'))
        body = body.replace(
          '<body>',
          '<body><p style="padding:12px;background:#fff3cc"><strong>LOCAL SIMULATION · Fictional proposals only · Nothing will be sent or changed.</strong></p>',
        );
      outgoing.end(body);
    } catch {
      outgoing.writeHead(500);
      outgoing.end('preview_unavailable');
    }
  })
  .listen(port, '127.0.0.1', () =>
    console.log('Synthetic approval preview: ' + origin),
  );
