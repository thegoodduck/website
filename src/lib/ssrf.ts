import { lookup as dnsLookup } from 'dns';
import { BlockList, isIP } from 'net';
import { Agent, fetch as undiciFetch } from 'undici';

const blocked = new BlockList();
const v4: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];
for (const [a, p] of v4) blocked.addSubnet(a, p, 'ipv4');
const v6: [string, number][] = [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
  ['2001::', 32], ['2001:db8::', 32], ['2002::', 16], ['100::', 64],
];
for (const [a, p] of v6) blocked.addSubnet(a, p, 'ipv6');

/** Expand an IPv6 literal to 8 hextets. */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0];
  const m = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (m) {
    const [a, b, c, d] = m[1].split('.').map(Number);
    s = s.slice(0, -m[1].length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const [head, tail] = s.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  if (fill < 0) return null;
  const parts = [...h, ...Array(fill).fill('0'), ...t].map(x => parseInt(x, 16));
  return parts.length === 8 && parts.every(n => n >= 0 && n <= 0xffff) ? parts : null;
}

export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return blocked.check(ip, 'ipv4');
  if (kind !== 6) return true;
  const h = expandV6(ip);
  if (!h) return true;
  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d) and NAT64 (64:ff9b::/96): judge the embedded v4
  const embedded =
    (h.slice(0, 5).every(x => x === 0) && h[5] === 0xffff) ||
    h.slice(0, 6).every(x => x === 0) ||
    (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every(x => x === 0));
  if (embedded) {
    return blocked.check(`${h[6] >> 8}.${h[6] & 255}.${h[7] >> 8}.${h[7] & 255}`, 'ipv4');
  }
  return blocked.check(h.map(x => x.toString(16)).join(':'), 'ipv6');
}

function hostOf(u: URL) {
  return u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function assertHostShape(u: URL) {
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol');
  const host = hostOf(u);
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('blocked host');
  }
  if (isIP(host) && isPrivateIp(host)) throw new Error('blocked host');
}

/** Cheap pre-check (no DNS). The real enforcement happens at connect time in safeFetch. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  assertHostShape(u);
  return u;
}

// Validate the address the socket will actually use, so DNS answers can't change between check and connect.
const agent = new Agent({
  connect: {
    lookup(hostname, opts, cb) {
      dnsLookup(hostname, { ...opts, all: true }, (err, addrs) => {
        const list = (addrs as unknown as { address: string; family: number }[]) || [];
        if (err) return (cb as any)(err);
        const ok = list.filter(a => !isPrivateIp(a.address));
        if (!list.length || ok.length !== list.length) return (cb as any)(new Error('blocked host'));
        if ((opts as any)?.all) return (cb as any)(null, ok);
        (cb as any)(null, ok[0].address, ok[0].family);
      });
    },
  },
});

export type SafeResponse = Awaited<ReturnType<typeof undiciFetch>> & { finalUrl: string };

/** fetch() that pins validated IPs at connect time and re-validates every redirect hop. */
export async function safeFetch(raw: string, init: Record<string, any> = {}, maxRedirects = 5): Promise<SafeResponse> {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    assertHostShape(new URL(current));
    const res = await undiciFetch(current, { ...init, redirect: 'manual', dispatcher: agent });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    return Object.assign(res, { finalUrl: current });
  }
  throw new Error('too many redirects');
}
