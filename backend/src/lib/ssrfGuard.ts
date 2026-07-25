import dns from 'dns';
import { ApiError } from './errors.js';

// Private / reserved address ranges that must never be the target of
// an admin-supplied outbound URL (ticket validation endpoint, etc.)
const PRIVATE_CIDRS = [
  // IPv4
  { prefix: '10.', bits: 8 },
  { prefix: '172.', ranges: [16, 31] },   // 172.16 – 172.31
  { prefix: '192.168.', bits: 16 },
  { prefix: '127.', bits: 8 },            // loopback
  { prefix: '169.254.', bits: 16 },       // link-local / AWS metadata
  { prefix: '0.', bits: 8 },
  { prefix: '255.255.255.255', bits: 32 },
];

const PRIVATE_IPV6_PREFIXES = [
  '::1',           // loopback
  'fc',            // fc00::/7 Unique Local
  'fd',
  'fe80',          // link-local
  '::ffff:',       // IPv4-mapped
];

function isPrivateIpv4(ip: string): boolean {
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1] ?? '0', 10);
    if (second >= 16 && second <= 31) return true;
  }
  return PRIVATE_CIDRS.some((c) => {
    if ('ranges' in c) return false; // handled above
    return ip.startsWith(c.prefix);
  });
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return PRIVATE_IPV6_PREFIXES.some((p) => lower.startsWith(p));
}

export async function ssrfGuard(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw ApiError.ticketUrlInvalid('URL is malformed');
  }

  // Scheme check
  const allowHttp = process.env['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'] === 'true' ||
    process.env['NODE_ENV'] !== 'production';

  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    throw ApiError.ticketUrlInvalid(`Only https:// URLs are allowed (got ${parsed.protocol})`);
  }

  // No file://, ftp://, etc
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw ApiError.ticketUrlInvalid(`Protocol ${parsed.protocol} is not allowed`);
  }

  // Resolve hostname
  const hostname = parsed.hostname;

  // Reject bare IPs in restricted ranges before DNS resolution
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const allowPrivate = process.env['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'] === 'true';
    if (!allowPrivate && isPrivateIpv4(hostname)) {
      throw ApiError.ticketUrlInvalid(`IP address ${hostname} is in a private range`);
    }
    return;
  }

  if (hostname.includes(':')) {
    // IPv6 literal
    const allowPrivate = process.env['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'] === 'true';
    if (!allowPrivate && isPrivateIpv6(hostname)) {
      throw ApiError.ticketUrlInvalid(`IPv6 address ${hostname} is in a private range`);
    }
    return;
  }

  // Resolve hostname and check resulting IPs
  let addresses: dns.LookupAddress[];
  try {
    addresses = await new Promise((resolve, reject) =>
      dns.lookup(hostname, { all: true }, (err, addrs) =>
        err ? reject(err) : resolve(addrs),
      ),
    );
  } catch {
    throw ApiError.ticketUrlInvalid(`Could not resolve hostname: ${hostname}`);
  }

  const allowPrivate = process.env['OUTBOUND_HTTP_ALLOW_PRIVATE_IPS'] === 'true';
  if (!allowPrivate) {
    for (const { address, family } of addresses) {
      if (family === 4 && isPrivateIpv4(address)) {
        throw ApiError.ticketUrlInvalid(`Hostname ${hostname} resolves to private address ${address}`);
      }
      if (family === 6 && isPrivateIpv6(address)) {
        throw ApiError.ticketUrlInvalid(`Hostname ${hostname} resolves to private IPv6 address ${address}`);
      }
    }
  }
}
