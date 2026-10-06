import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { HttpRequestInit, HttpResponse } from './types.js';

export const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface OutboundPolicyOptions {
  allowOrigins?: readonly string[];
  resolveHostname?: (hostname: string) => Promise<readonly string[]>;
  fetch?: (input: string, init?: HttpRequestInit) => Promise<Response>;
  maxRedirects?: number;
  maxBytes?: number;
  deniedRegistrableDomains?: readonly string[];
}

export class OutboundPolicyError extends Error {
  readonly kind = 'policy' as const;
  readonly code: 'restricted-domain';
  readonly url: string;
  redirectChain?: readonly string[];

  constructor(url: string) {
    super(`outbound URL target is denied by restricted-domain policy: ${url}`);
    this.name = 'OutboundPolicyError';
    this.code = 'restricted-domain';
    this.url = url;
  }
}

const SECOND_LEVEL_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'com.au',
  'net.au',
  'co.nz',
  'com.br',
]);

function registrableDomain(value: string): string | null {
  try {
    const host = new URL(value).hostname
      .toLowerCase()
      .replace(/\.$/u, '')
      .replace(/^www\./u, '');
    const labels = host.split('.');
    if (!host || labels.length < 2) return host || null;
    const suffix = labels.slice(-2).join('.');
    return SECOND_LEVEL_SUFFIXES.has(suffix)
      ? labels.slice(-3).join('.')
      : labels.slice(-2).join('.');
  } catch {
    try {
      const host = new URL(`https://${value}`).hostname
        .toLowerCase()
        .replace(/\.$/u, '')
        .replace(/^www\./u, '');
      const labels = host.split('.');
      if (!host || labels.length < 2) return host || null;
      const suffix = labels.slice(-2).join('.');
      return SECOND_LEVEL_SUFFIXES.has(suffix)
        ? labels.slice(-3).join('.')
        : labels.slice(-2).join('.');
    } catch {
      return null;
    }
  }
}

function normalizeDeniedDomains(
  values: readonly string[] | undefined
): ReadonlySet<string> {
  return new Set(
    (values ?? [])
      .map(registrableDomain)
      .filter((value): value is string => value !== null)
  );
}

export const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;

/** Connection-establishment failures that are safe to retry on another address. */
const CONNECT_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EADDRNOTAVAIL',
  'ECONNRESET',
  'CONNECT_TIMEOUT',
]);

export class ConnectError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ConnectError';
    this.code = code;
  }
}

/** IPv4 first, preserving resolver order within each family. */
export function orderAddresses(addresses: readonly string[]): string[] {
  return [
    ...addresses.filter((address) => !address.includes(':')),
    ...addresses.filter((address) => address.includes(':')),
  ];
}

export type PinnedAttempt = (
  value: string,
  init: HttpRequestInit,
  address: string,
  maxBytes: number
) => Promise<Response>;

/**
 * Try each resolved address until one connects. Hosts with a broken IPv6
 * route otherwise fail every dual-stack site. Only failures before the
 * request reached a server are retried; aborts and HTTP responses are final.
 */
export async function fetchWithAddressFallback(
  value: string,
  init: HttpRequestInit,
  addresses: readonly string[],
  maxBytes: number,
  attempt: PinnedAttempt = pinnedFetch
): Promise<Response> {
  const errors: string[] = [];
  for (const address of orderAddresses(addresses)) {
    if (init.signal?.aborted) throw new Error('request aborted');
    try {
      return await attempt(value, init, address, maxBytes);
    } catch (error) {
      if (!(error instanceof ConnectError)) throw error;
      errors.push(
        `${address}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  throw new Error(
    `could not connect to any resolved address (${errors.join('; ')})`
  );
}

function pinnedFetch(
  value: string,
  init: HttpRequestInit,
  address: string,
  maxBytes: number
): Promise<Response> {
  const url = new URL(value);
  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    headers['host'] = url.host;
    const request = transport(
      {
        hostname: address,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: init.method ?? 'GET',
        headers,
        ...(url.protocol === 'https:' ? { servername: url.hostname } : {}),
        lookup: (_hostname, _options, callback) =>
          callback(null, address, address.includes(':') ? 6 : 4),
      },
      (response) => {
        const declaredLength = Number(response.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
          request.destroy(new Error(`response exceeds ${maxBytes} byte limit`));
          reject(new Error(`response exceeds ${maxBytes} byte limit`));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        let rejected = false;
        response.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes && !rejected) {
            rejected = true;
            response.destroy(
              new Error(`response exceeds ${maxBytes} byte limit`)
            );
            reject(new Error(`response exceeds ${maxBytes} byte limit`));
          } else if (!rejected) {
            chunks.push(chunk);
          }
        });
        response.on('end', () => {
          if (rejected) return;
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(response.headers)) {
            if (Array.isArray(value))
              value.forEach((entry) => responseHeaders.append(key, entry));
            else if (value !== undefined) responseHeaders.set(key, value);
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 0,
              headers: responseHeaders,
            })
          );
        });
        response.on('error', reject);
      }
    );
    let connected = false;
    const connectTimer = setTimeout(() => {
      if (!connected)
        request.destroy(
          new ConnectError(
            `connect timed out after ${DEFAULT_CONNECT_TIMEOUT_MS}ms`,
            'CONNECT_TIMEOUT'
          )
        );
    }, DEFAULT_CONNECT_TIMEOUT_MS);
    request.on('socket', (socket) => {
      const markConnected = () => {
        connected = true;
        clearTimeout(connectTimer);
      };
      if (!socket.connecting) markConnected();
      else socket.once('connect', markConnected);
    });
    request.on('close', () => clearTimeout(connectTimer));
    request.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(connectTimer);
      reject(
        !connected && error.code && CONNECT_ERROR_CODES.has(error.code)
          ? new ConnectError(error.message, error.code)
          : error
      );
    });
    if (init.signal) {
      if (init.signal.aborted) {
        request.destroy();
        reject(new Error('request aborted'));
      } else
        init.signal.addEventListener(
          'abort',
          () => request.destroy(new Error('request aborted')),
          { once: true }
        );
    }
    if (init.body !== undefined && init.body !== null)
      request.write(init.body as string | Uint8Array);
    request.end();
  });
}

function ipv4Private(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 &&
      (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) ||
    (a === 198 && b >= 18 && b <= 19) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function ipv6Private(address: string): boolean {
  const value = address.toLowerCase().split('%')[0];
  if (!value.includes(':')) return ipv4Private(value);
  if (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe8') ||
    value.startsWith('fe9') ||
    value.startsWith('fea') ||
    value.startsWith('feb') ||
    value.startsWith('ff') ||
    value.startsWith('2001:db8') ||
    value.startsWith('2001:10') ||
    value.startsWith('2001:2') ||
    value.startsWith('2001:20') ||
    value.startsWith('3fff:')
  )
    return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? ipv4Private(mapped[1]) : false;
}

function privateAddress(address: string): boolean {
  return address.includes(':') ? ipv6Private(address) : ipv4Private(address);
}

export class OutboundPolicy {
  private readonly allowOrigins: ReadonlySet<string>;
  private readonly resolveHostname: (
    hostname: string
  ) => Promise<readonly string[]>;
  private readonly fetcher: (
    input: string,
    init?: HttpRequestInit
  ) => Promise<Response>;
  private readonly maxRedirects: number;
  private readonly maxBytes: number;
  private readonly deniedRegistrableDomains: ReadonlySet<string>;

  constructor(options: OutboundPolicyOptions = {}) {
    this.allowOrigins = new Set(
      (options.allowOrigins ?? []).map((origin) => new URL(origin).origin)
    );
    this.resolveHostname =
      options.resolveHostname ??
      (async (hostname) =>
        (await dnsLookup(hostname, { all: true })).map(
          (entry) => entry.address
        ));
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.deniedRegistrableDomains = normalizeDeniedDomains(
      options.deniedRegistrableDomains
    );
    this.fetcher =
      options.fetch ??
      (async (input, init = {}) => {
        const addresses = await this.resolveHostname(new URL(input).hostname);
        if (!addresses.length || addresses.some(privateAddress))
          throw new Error('outbound DNS resolution is unsafe');
        return fetchWithAddressFallback(
          input,
          init,
          addresses,
          init.maxBytes ?? this.maxBytes
        );
      });
    this.maxRedirects = options.maxRedirects ?? 5;
  }

  async validate(
    value: string,
    baseUrl?: string,
    allowPublicCrossOriginRedirects = false,
    deniedRegistrableDomains: ReadonlySet<string> = this
      .deniedRegistrableDomains
  ): Promise<URL> {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`outbound URL is malformed: ${value}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error(`outbound URL protocol is not allowed: ${url.protocol}`);
    const deniedDomain = registrableDomain(url.toString());
    if (deniedDomain && deniedRegistrableDomains.has(deniedDomain))
      throw new OutboundPolicyError(url.toString());
    if (baseUrl) {
      const base = new URL(baseUrl);
      if (
        url.origin !== base.origin &&
        !this.allowOrigins.has(url.origin) &&
        !allowPublicCrossOriginRedirects
      )
        throw new Error(`outbound URL origin is not allowed: ${url.origin}`);
    }
    const addresses = await this.resolveHostname(url.hostname);
    if (!addresses.length || addresses.some(privateAddress))
      throw new Error(
        `outbound URL resolves to a private, loopback, link-local, or reserved address: ${url.hostname}`
      );
    return url;
  }

  async fetch(
    value: string,
    init: HttpRequestInit = {}
  ): Promise<HttpResponse> {
    return this.fetchWithPolicy(value, init);
  }

  private async fetchWithPolicy(
    value: string,
    init: HttpRequestInit
  ): Promise<HttpResponse> {
    const allowPublicCrossOriginRedirects =
      init.policy?.allowPublicCrossOriginRedirects === true;
    const deniedRegistrableDomains = new Set([
      ...this.deniedRegistrableDomains,
      ...normalizeDeniedDomains(init.policy?.deniedRegistrableDomains),
    ]);
    let current = await this.validate(
      value,
      undefined,
      false,
      deniedRegistrableDomains
    );
    const redirectChain = [current.toString()];
    for (let redirects = 0; redirects <= this.maxRedirects; redirects += 1) {
      const response = await this.enforceSize(
        await this.fetchOnce(current.toString(), {
          ...init,
          redirect: 'manual',
        }),
        init.maxBytes ?? this.maxBytes
      );
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        return Object.assign(response, {
          finalUrl: current.toString(),
          redirectChain: [...redirectChain],
        }) as HttpResponse;
      }
      const location = response.headers.get('location');
      if (!location) throw new Error('outbound redirect has no location');
      if (redirects === this.maxRedirects)
        throw new Error('outbound redirect limit exceeded');
      try {
        current = await this.validate(
          new URL(location, current).toString(),
          current.toString(),
          allowPublicCrossOriginRedirects,
          deniedRegistrableDomains
        );
      } catch (error) {
        if (error instanceof OutboundPolicyError)
          error.redirectChain = [...redirectChain, error.url];
        throw error;
      }
      redirectChain.push(current.toString());
    }
    throw new Error('outbound redirect limit exceeded');
  }

  private async fetchOnce(
    input: string,
    init: HttpRequestInit
  ): Promise<Response> {
    const timeoutMs = init.timeoutMs;
    if (
      !Number.isFinite(timeoutMs) ||
      timeoutMs === undefined ||
      timeoutMs <= 0
    )
      return this.fetcher(input, init);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    else init.signal?.addEventListener('abort', onAbort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const request = this.fetcher(input, { ...init, signal: controller.signal });
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`outbound request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      init.signal?.removeEventListener('abort', onAbort);
    }
  }

  private async enforceSize(
    response: Response,
    maxBytes: number
  ): Promise<Response> {
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
      throw new Error(`response exceeds ${maxBytes} byte limit`);
    if (!response.body) return response;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        total += next.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel('response exceeds byte limit');
          throw new Error(`response exceeds ${maxBytes} byte limit`);
        }
        chunks.push(next.value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
    return new Response(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }
    );
  }
}
