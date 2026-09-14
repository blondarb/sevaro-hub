import {requireThat,ContextError} from '../command-center/context.mjs';
const LIMIT = 8192;
export async function boundedBody(request) {
  requireThat(
    request.headers.get('content-type') === 'application/json',
    'json_required',
  );
  const reader = request.body?.getReader();
  requireThat(reader, 'body_required');
  let bytes = 0,
    parts = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > LIMIT) {
      await reader.cancel();
      requireThat(false, 'request_too_large');
    }
    parts.push(value);
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
  } catch {
    throw new ContextError('invalid_request');
  }
}
