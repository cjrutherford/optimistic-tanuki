import { createHmac } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';

/**
 * Where a submission came from, as the corroboration gate needs it and no
 * more: keyed hashes of the network and the client. The network is the /24
 * of an IPv4 address or the /48 of an IPv6 one, so neighbours on one
 * connection count as one source while the address itself is never stored.
 * Without the key the hashes cannot be reversed by trying addresses.
 *
 * Behind a proxy, the address is only right once the gateway trusts exactly
 * that proxy.
 */

export interface RequestOrigin {
  network: string;
  client: string;
}

export function networkOf(address: string): string {
  const plain = address.replace(/^::ffff:/u, '');
  if (isIPv4(plain)) return plain.split('.').slice(0, 3).join('.') + '.0/24';
  if (isIPv6(plain)) {
    const groups = expandV6(plain);
    return `${groups.slice(0, 3).join(':')}::/48`;
  }
  return 'unknown';
}

function expandV6(address: string): string[] {
  const [head, tail = ''] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = address.includes('::') ? 8 - left.length - right.length : 0;
  return [...left, ...Array(missing).fill('0'), ...right].map((group) =>
    group.toLowerCase().padStart(4, '0')
  );
}

export function originOf(
  key: string,
  address: string | undefined,
  userAgent: string | undefined
): RequestOrigin {
  const digest = (kind: string, value: string) =>
    createHmac('sha256', key)
      .update(`${kind}:${value}`)
      .digest('hex')
      .slice(0, 32);
  return {
    network: digest('network', networkOf(address ?? 'unknown')),
    client: digest('client', userAgent ?? ''),
  };
}
