import dns from 'node:dns';
import { env } from '../config/env.js';
import { ApiError } from './errors.js';

/**
 * Guards outbound requests to admin-supplied URLs (dev3 §6.3). A museum admin
 * sets their own ticketValidationUrl, so without this check that field is an
 * SSRF primitive pointed at cloud metadata endpoints or internal services.
 *
 * Ported from dev3's branch, with process.env reads replaced by the validated
 * env module. Note the residual TOCTOU: the DNS answer checked here is not
 * necessarily the one fetch() later connects to (DNS rebinding).
 */

const PRIVATE_IPV4_PREFIXES = [
  '10.',
  '192.168.',
  '127.', // loopback
  '169.254.', // link-local, including cloud metadata endpoints
  '0.',
  '255.255.255.255',
];

const PRIVATE_IPV6_PREFIXES = [
  '::1', // loopback
  'fc', // fc00::/7 unique local
  'fd',
  'fe80', // link-local
  '::ffff:', // IPv4-mapped
];

function isPrivateIpv4(ip: string): boolean {
  // 172.16.0.0 – 172.31.255.255 is private; the rest of 172/8 is not.
  if (ip.startsWith('172.')) {
    const secondOctet = Number.parseInt(ip.split('.')[1] ?? '0', 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }
  return PRIVATE_IPV4_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return PRIVATE_IPV6_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

async function resolveHost(hostname: string): Promise<dns.LookupAddress[]> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses);
    });
  });
}

export async function ssrfGuard(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw ApiError.ticketUrlInvalid('URL is malformed');
  }

  const allowPrivate = env.OUTBOUND_HTTP_ALLOW_PRIVATE_IPS;
  // Plain http is tolerated outside production, or when private targets are
  // explicitly allowed, so a local vendor stub is reachable in development.
  const allowHttp = allowPrivate || env.NODE_ENV !== 'production';

  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    throw ApiError.ticketUrlInvalid(`only https:// URLs are allowed (got ${parsed.protocol})`);
  }

  const { hostname } = parsed;

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (!allowPrivate && isPrivateIpv4(hostname)) {
      throw ApiError.ticketUrlInvalid(`IP address ${hostname} is in a private range`);
    }
    return;
  }

  if (hostname.includes(':')) {
    const literal = hostname.replace(/^\[|\]$/g, '');
    if (!allowPrivate && isPrivateIpv6(literal)) {
      throw ApiError.ticketUrlInvalid(`IPv6 address ${literal} is in a private range`);
    }
    return;
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await resolveHost(hostname);
  } catch {
    throw ApiError.ticketUrlInvalid(`could not resolve hostname: ${hostname}`);
  }

  if (allowPrivate) return;

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) {
      throw ApiError.ticketUrlInvalid(
        `hostname ${hostname} resolves to private address ${address}`,
      );
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw ApiError.ticketUrlInvalid(
        `hostname ${hostname} resolves to private IPv6 address ${address}`,
      );
    }
  }
}
