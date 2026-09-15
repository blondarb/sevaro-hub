// Source links are navigation, never credentials or arbitrary redirects.
// Graph's event/message webLink uses these exact work/school Outlook routes:
// https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0
// https://learn.microsoft.com/en-us/graph/api/message-get?view=graph-rest-1.0
export function isAllowedSourceUrl(value, allowedHosts) {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\\\u0000-\u001f\u007f]/u.test(value) || !Array.isArray(allowedHosts)) return false;
  let parsed;
  try { parsed = new URL(value); } catch { return false; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.hash || !allowedHosts.includes(parsed.hostname)) return false;
  // Navigation to a Claude-reviewed source only; no Slack API or ingestion access.
  if (parsed.hostname === 'sevarohealth.slack.com') return !parsed.search && /^\/archives\/[CG][A-Z0-9]+\/p\d{16}$/.test(parsed.pathname);
  if (parsed.hostname !== 'outlook.office365.com') return !parsed.search;
  // Only documented read-event/read-message navigation parameters are accepted. Do not
  // allow general Outlook queries, tokens, message bodies, or return URLs.
  if (parsed.pathname !== '/owa/') return false;
  const entries = [...parsed.searchParams.entries()];
  if (entries.length !== 3 || new Set(entries.map(([key]) => key)).size !== 3) return false;
  const parameters = Object.fromEntries(entries);
  const event = Object.keys(parameters).every(key => ['itemid', 'exvsurl', 'path'].includes(key)) &&
    typeof parameters.itemid === 'string' && /^[A-Za-z0-9+/_=-]{1,2048}$/.test(parameters.itemid) &&
    parameters.exvsurl === '1' && parameters.path === '/calendar/item';
  const message = Object.keys(parameters).every(key => ['ItemID', 'exvsurl', 'viewmodel'].includes(key)) &&
    typeof parameters.ItemID === 'string' && /^[A-Za-z0-9+/_=-]{1,2048}$/.test(parameters.ItemID) &&
    parameters.exvsurl === '1' && parameters.viewmodel === 'ReadMessageItem';
  return event || message;
}

// A reply obligation must point to its communication, never a related initiative
// or calendar event. This is a structural gate, not proof the claim is true.
export function isCommunicationSourceUrl(value, allowedHosts) {
  if (!isAllowedSourceUrl(value, allowedHosts)) return false;
  const url = new URL(value);
  return url.hostname === 'sevarohealth.slack.com' ||
    (url.hostname === 'outlook.office365.com' && url.searchParams.get('viewmodel') === 'ReadMessageItem');
}
