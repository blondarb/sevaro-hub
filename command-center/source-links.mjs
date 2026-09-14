// Source links are navigation, never credentials or arbitrary redirects.
// Graph's event webLink uses this exact work/school Outlook route:
// https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0
export function isAllowedSourceUrl(value, allowedHosts) {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\\\u0000-\u001f\u007f]/u.test(value) || !Array.isArray(allowedHosts)) return false;
  let parsed;
  try { parsed = new URL(value); } catch { return false; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.hash || !allowedHosts.includes(parsed.hostname)) return false;
  if (parsed.hostname !== 'outlook.office365.com') return !parsed.search;
  // Only the documented read-event navigation parameters are accepted. Do not
  // allow general Outlook queries, tokens, message bodies, or return URLs.
  if (parsed.pathname !== '/owa/') return false;
  const entries = [...parsed.searchParams.entries()];
  if (entries.length !== 3 || new Set(entries.map(([key]) => key)).size !== 3) return false;
  const parameters = Object.fromEntries(entries);
  return Object.keys(parameters).every(key => ['itemid', 'exvsurl', 'path'].includes(key)) &&
    typeof parameters.itemid === 'string' && /^[A-Za-z0-9+/_=-]{1,2048}$/.test(parameters.itemid) &&
    parameters.exvsurl === '1' && parameters.path === '/calendar/item';
}
