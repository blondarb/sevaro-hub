import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedSourceUrl} from './source-links.mjs';
import {LINK_HOSTS} from './release.mjs';

const hosts = ['app.asana.com', 'github.com', 'outlook.office.com', 'outlook.office365.com'];
const event = 'https://outlook.office365.com/owa/?itemid=syntheticAAMk%2B%2F%3D&exvsurl=1&path=%2Fcalendar%2Fitem';
test('reviewed Slack links only allow the fixed workspace message permalink', () => {
  const link = 'https://sevarohealth.slack.com/archives/C0SYNTHETIC/p1789391165151239';
  assert.equal(isAllowedSourceUrl(link, LINK_HOSTS), true);
  assert.equal(isAllowedSourceUrl(link, hosts), false);
  for (const value of [
    link.replace('sevarohealth', 'other'), link.replace('.com/', '.com.evil.example/'),
    link.replace('https:', 'http:'), link.replace('https://', 'https://user:password@'),
    link + '?token=synthetic', link + '?thread_ts=1789391165.151239', link + '#fragment',
    link.replace('/archives/', '/api/'), link.replace('/p1789391165151239', ''),
    link.replace('/C0SYNTHETIC/', '/%430SYNTHETIC/'),
    link.replace('p1789391165151239', 'p123'),
  ]) assert.equal(isAllowedSourceUrl(value, LINK_HOSTS), false, value);
});
test('documented Outlook event route requires an explicitly allowed host', () => {
  assert.equal(isAllowedSourceUrl(event, hosts), true);
  assert.equal(isAllowedSourceUrl(event, hosts.filter(h => h !== 'outlook.office365.com')), false);
  assert.equal(isAllowedSourceUrl('https://app.asana.com/0/123/456', hosts), true);
});
test('query allowance is restricted to one read-event route', () => {
  for (const url of [
    event.replace('/owa/', '/mail/'), event.replace('calendar', 'mail'),
    event.replace('exvsurl=1', 'exvsurl=2'), event.replace('itemid=', 'body='),
    event.replace('outlook.office365.com', 'outlook.office.com'),
    'https://outlook.office365.com/owa/',
    'https://app.asana.com/0/123/456?access_token=synthetic',
    event + '&returnUrl=https://example.com', event + '&access_token=synthetic',
    event + '&itemid=other', event + '&path=%2Fcalendar%2Fitem',
    event.replace('itemid=syntheticAAMk%2B%2F%3D', 'itemid='),
    event.replace('itemid=syntheticAAMk%2B%2F%3D', 'itemid=raw%20text'),
    event.replace('itemid=syntheticAAMk%2B%2F%3D', 'itemid=' + 'A'.repeat(2049)),
  ]) assert.equal(isAllowedSourceUrl(url, hosts), false);
});
test('credentials, wrong destinations and ambiguous navigation fail closed', () => {
  for (const url of [
    event.replace('https:', 'http:'), event.replace('https://', 'https://user:password@'),
    event.replace('.com/owa/', '.com:444/owa/'), event + '#fragment',
    event.replace('office365.com', 'office365.com.evil.example'),
    event.replace('/owa/', '\\owa/'), '\n' + event,
    event.replace('itemid=syntheticAAMk%2B%2F%3D', 'itemid=%00'),
  ]) assert.equal(isAllowedSourceUrl(url, hosts), false);
});
