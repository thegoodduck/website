import { lookup } from 'dns/promises';
import { isIP } from 'net';

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) {
    const l = ip.toLowerCase();
    if (l === '::' || l === '::1') return true;
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateV4(mapped[1]);
    if (l.startsWith('::ffff:')) return true; // hex-form mapped addresses: refuse
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff');
  }
  return true;
}

/** Throws unless the URL is http(s) and every address its host resolves to is public. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new Error('blocked host');
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error('blocked host');
    return u;
  }
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('blocked host');
  return u;
}

/** fetch() that validates the target and every redirect hop. */
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response & { finalUrl: string }> {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, current).toString();
      continue;
    }
    return Object.assign(res, { finalUrl: current });
  }
  throw new Error('too many redirects');
}
