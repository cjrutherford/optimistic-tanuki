import { lookup } from 'dns/promises';
import { isIP } from 'net';

/**
 * The vault air gap, enforced rather than asserted.
 *
 * Confidential practice documents and the questions asked about them must not
 * reach anything but the on-premises model. The response used to carry
 * `airGapped: true` on the strength of nothing more than an intent to call a
 * local address: any host the deployment named was dialled, and a name that
 * resolved off-box was followed without comment. This module is the boundary
 * that replaces that claim.
 *
 * Two rules, both applied on every request rather than once at boot, so a
 * deployment that is re-pointed at a public host starts failing instead of
 * quietly leaking:
 *
 *  1. The endpoint has to be a syntactically valid http(s) URL with no
 *     credentials in it. Nothing else is a local model host.
 *  2. Every address the host resolves to must be a loopback, private,
 *     link-local, or carrier-grade-NAT address. A name that resolves to a
 *     public address is refused, and so is one that resolves to a mix: that is
 *     what a rebind looks like.
 *
 * The residual is DNS being resolved once by this check and once again by the
 * socket. A host that returns a local address to the check and a public one to
 * the connect would pass. Closing that needs a pinned socket or a
 * network-namespace, neither of which is available to a plain fetch, so the
 * check runs immediately before every request and the operator's endpoint is
 * expected to be an address rather than a name.
 */

export class VaultAirGapError extends Error {
  constructor(message: string) {
    super(`Vault air gap refused this request. ${message}`);
    this.name = 'VaultAirGapError';
  }
}

export type VaultAddressResolver = (hostname: string) => Promise<string[]>;

const defaultResolver: VaultAddressResolver = async (hostname) => {
  const results = await lookup(hostname, { all: true });
  return results.map((result) => result.address);
};

const parseIpv4 = (address: string): number[] | null => {
  const parts = address.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const octets = parts.map((part) => Number(part));
  if (
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return null;
  }
  return octets;
};

/**
 * The blocks an on-premises model host is allowed to live on.
 *
 * 100.64.0.0/10 is here because the deployment this replaced reached its model
 * over a tailnet address rather than loopback; treating that range as public
 * would have been a way of saying the air gap holds while forbidding the one
 * configuration that was actually in use.
 */
const isLocalIpv4 = (octets: number[]): boolean => {
  const [a, b] = octets;

  if (a === 127) {
    return true;
  }
  if (a === 0) {
    return false;
  }
  if (a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  return false;
};

const isLocalIpv6 = (address: string): boolean => {
  const normalized = address.toLowerCase().split('%')[0];

  if (normalized === '::1') {
    return true;
  }
  if (normalized === '::') {
    return false;
  }

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) {
    const octets = parseIpv4(mapped[1]);
    return octets ? isLocalIpv4(octets) : false;
  }

  const head = normalized.split(':')[0].padStart(4, '0');
  const leading = parseInt(head.slice(0, 2), 16);
  const second = parseInt(head.slice(2, 4), 16);

  if ((leading & 0xfe) === 0xfc) {
    return true;
  }
  if (leading === 0xfe && (second & 0xc0) === 0x80) {
    return true;
  }
  return false;
};

export const isLocalNetworkAddress = (address: string): boolean => {
  if (typeof address !== 'string' || !address.trim()) {
    return false;
  }
  const trimmed = address.trim();
  const family = isIP(trimmed);

  if (family === 4) {
    const octets = parseIpv4(trimmed);
    return octets ? isLocalIpv4(octets) : false;
  }
  if (family === 6) {
    return isLocalIpv6(trimmed);
  }
  return false;
};

const toUrl = (endpoint: string): URL => {
  // A scheme is only assumed when one is absent. `file:///etc/passwd` has to
  // reach the parser intact so it is refused by name, not laundered into an
  // http request against a host called "file".
  const withScheme = endpoint.includes('://') ? endpoint : `http://${endpoint}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new VaultAirGapError(
      `"${endpoint}" is not a usable http(s) URL, so it cannot be a local model host.`
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new VaultAirGapError(
      `The scheme "${url.protocol}" is not permitted. Only http and https reach a local model host.`
    );
  }

  if (url.username || url.password) {
    throw new VaultAirGapError(
      'An endpoint carrying credentials in it was refused; a local model host is addressed by host and port alone.'
    );
  }

  if (!url.hostname) {
    throw new VaultAirGapError(`"${endpoint}" has no host to check.`);
  }

  return url;
};

/**
 * Resolves `endpoint` and refuses it unless every address it points at is on
 * this network. Returns the normalised URL for the caller to use, so the value
 * that was checked is the value that gets dialled.
 */
export const assertLocalVaultEndpoint = async (
  endpoint: string | undefined | null,
  resolve: VaultAddressResolver = defaultResolver
): Promise<URL> => {
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw new VaultAirGapError(
      'The local model endpoint is not configured, so there is nowhere on this network to send confidential content. Set VAULT_OLLAMA_BASE_URL.'
    );
  }

  const url = toUrl(endpoint.trim());
  const host = url.hostname.replace(/^\[|\]$/g, '');

  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = await resolve(host);
    } catch (error) {
      throw new VaultAirGapError(
        `"${host}" could not be resolved, so it cannot be shown to be on this network.`
      );
    }
  }

  if (addresses.length === 0) {
    throw new VaultAirGapError(
      `"${host}" resolved to no addresses, so it cannot be shown to be on this network.`
    );
  }

  const offNetwork = addresses.filter(
    (address) => !isLocalNetworkAddress(address)
  );
  if (offNetwork.length > 0) {
    throw new VaultAirGapError(
      `"${host}" resolves to ${offNetwork.join(
        ', '
      )}, which is not on this network. The vault path reaches the configured local model and nothing else.`
    );
  }

  return url;
};
