'use strict';

/**
 * Outbound request guard for URLs that other people supply.
 *
 * The availability layer's whole Tier-1 story is a business handing us a
 * calendar URL, which means the server makes HTTP requests to addresses
 * strangers choose. Without a guard that is a server-side request forgery
 * hole: the attacker does not need to reach the internal network themselves,
 * they just need our server to reach it for them and hand back the body.
 *
 * What an unguarded fetch gives away, in order of how bad it is:
 *   https://169.254.169.254/...      cloud instance metadata - on AWS, GCP and
 *                                    Azure this is where temporary IAM
 *                                    credentials live. Reading it is a full
 *                                    compromise of whatever the server can do.
 *   https://metadata.google.internal the same thing behind a friendly name, so
 *                                    a literal-IP blocklist alone misses it.
 *   https://127.0.0.1:9200/...       internal services that bind to loopback
 *                                    precisely because they assume nobody
 *                                    outside can reach them - databases,
 *                                    search clusters, admin panels.
 *   https://10.x / 192.168.x         anything else on the private network.
 *
 * So the rules here are deliberately strict, and deny by default:
 *
 *   1. https only, on port 443. A calendar feed has no reason to be anywhere
 *      else, and odd ports are how internal services are reached.
 *   2. No credentials in the URL. `https://user:pass@host/` leaks whatever was
 *      put there into our logs and upstream.
 *   3. The hostname is resolved and every address it answers with must be
 *      publicly routable. Checking the literal text of the host is not enough,
 *      because a name can point anywhere.
 *   4. Redirects are followed by hand, one hop at a time, re-validating each.
 *      `redirect: 'follow'` would let a perfectly innocent public URL bounce
 *      us to the metadata service on hop two.
 *
 * Known residual risk, stated rather than papered over: between our DNS check
 * and the connection, a hostile resolver can answer differently - DNS
 * rebinding. Closing that completely means connecting to a pinned IP and
 * carrying the Host header ourselves, which Node's fetch does not expose. The
 * mitigations that remain are the short redirect budget and the response
 * having to look like an iCalendar file. For a production deployment the
 * stronger answer is to run these fetches through an egress proxy that is
 * itself on a network with no route to anything private.
 */

const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_REDIRECTS = 3;

/** Hostnames that are never legitimate feed sources, checked before DNS. */
const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

function ipv4Blocked(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true;                          // "this" network
  if (a === 10) return true;                         // private
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;  // private
  if (a === 192 && b === 168) return true;           // private
  if (a === 192 && b === 0) return true;             // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true;                         // multicast, reserved, broadcast
  return false;
}

/**
 * Expand an IPv6 address to its eight 16-bit groups.
 *
 * Written out rather than regex-matched because the URL parser normalises
 * addresses before we ever see them: `[::ffff:169.254.169.254]` arrives as
 * `::ffff:a9fe:a9fe`, and a check that only recognised the dotted form let
 * the cloud metadata service straight through.
 */
function expandV6(v) {
  let str = v;
  const tail4 = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(str);
  if (tail4) {
    const p = tail4[2].split('.').map(Number);
    if (p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    str = `${tail4[1]}${(((p[0] << 8) | p[1]) >>> 0).toString(16)}:${(((p[2] << 8) | p[3]) >>> 0).toString(16)}`;
  }
  const halves = str.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  let groups;
  if (halves.length === 1) {
    groups = head;
  } else {
    const tail = halves[1] ? halves[1].split(':').filter(Boolean) : [];
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array(fill).fill('0'), ...tail];
  }
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some((n) => !Number.isInteger(n)) ? null : nums;
}

function ipv6Blocked(ip) {
  const g = expandV6(ip.toLowerCase().split('%')[0]);   // drop any zone index
  if (!g) return true;                                  // unparseable: refuse rather than guess
  const embedded = () => [(g[6] >> 8) & 255, g[6] & 255, (g[7] >> 8) & 255, g[7] & 255].join('.');
  if (g.slice(0, 7).every((x) => x === 0) && g[7] <= 1) return true;   // :: and ::1
  const zeroTo4 = g.slice(0, 5).every((x) => x === 0);
  if (zeroTo4 && g[5] === 0xffff) return ipv4Blocked(embedded());      // ::ffff:a.b.c.d
  if (zeroTo4 && g[5] === 0) return ipv4Blocked(embedded());           // deprecated ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return ipv4Blocked(embedded());                                    // 64:ff9b::/96 NAT64
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true;                         // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true;                         // fe80::/10 link-local
  return false;
}

/** True when an address literal must not be contacted. */
function isBlockedAddress(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return ipv4Blocked(ip);
  if (kind === 6) return ipv6Blocked(ip);
  return true; // not an IP we understand: refuse rather than guess
}

/**
 * Validate one URL. Resolves DNS, so it is async.
 * @returns {Promise<{ok:boolean, url?:URL, error?:string}>}
 */
async function checkUrl(raw, { resolver = dns } = {}) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return { ok: false, error: 'not a url' };
  }
  if (u.protocol !== 'https:') return { ok: false, error: 'feed must be https' };
  if (u.username || u.password) return { ok: false, error: 'credentials in url are not allowed' };
  if (u.port && u.port !== '443') return { ok: false, error: 'feed must be on port 443' };

  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!host) return { ok: false, error: 'no host' };
  if (BLOCKED_HOSTS.has(host)) return { ok: false, error: 'host not allowed' };
  if (host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return { ok: false, error: 'host not allowed' };
  }

  // A literal address skips DNS; a name has to be resolved before we trust it.
  if (net.isIP(host)) {
    return isBlockedAddress(host)
      ? { ok: false, error: 'address is not publicly routable' }
      : { ok: true, url: u };
  }
  let addrs;
  try {
    addrs = await resolver.lookup(host, { all: true });
  } catch {
    return { ok: false, error: 'host does not resolve' };
  }
  if (!addrs || !addrs.length) return { ok: false, error: 'host does not resolve' };
  // Every answer must be safe. One private address among several is enough to
  // refuse, because we do not control which one the connection picks.
  for (const a of addrs) {
    if (isBlockedAddress(a.address)) {
      return { ok: false, error: 'host resolves to a non-public address' };
    }
  }
  return { ok: true, url: u };
}

/**
 * Fetch a URL supplied by someone else, validating every redirect hop.
 * Never throws; returns `{ok:false, error}` instead.
 */
async function safeFetch(raw, { fetchImpl = globalThis.fetch, signal, resolver, headers } = {}) {
  let target = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // eslint-disable-next-line no-await-in-loop
    const check = await checkUrl(target, { resolver });
    if (!check.ok) return { ok: false, error: check.error, blockedUrl: String(target) };

    let res;
    try {
      // 'manual' so a redirect cannot carry us somewhere we never validated
      // eslint-disable-next-line no-await-in-loop
      res = await fetchImpl(check.url.toString(), { signal, redirect: 'manual', headers });
    } catch (err) {
      return { ok: false, error: err && err.name === 'AbortError' ? 'timed out' : 'unreachable' };
    }
    if (res.status >= 300 && res.status < 400) {
      // An unread redirect body keeps its connection open; release it.
      try { if (res.body && typeof res.body.cancel === 'function') await res.body.cancel(); } catch { /* ignore */ }
      const loc = res.headers && typeof res.headers.get === 'function' ? res.headers.get('location') : null;
      if (!loc) return { ok: false, error: 'redirect without a location' };
      try {
        target = new URL(loc, check.url).toString();
      } catch {
        return { ok: false, error: 'bad redirect target' };
      }
      continue;
    }
    return { ok: true, res, url: check.url.toString() };
  }
  return { ok: false, error: 'too many redirects' };
}

module.exports = { safeFetch, checkUrl, isBlockedAddress, BLOCKED_HOSTS, MAX_REDIRECTS };
