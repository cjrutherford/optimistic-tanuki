export const TRUSTED_PROXY_CONFIG = 'BUSINESS_SECURITY_TRUSTED_PROXY';

export interface TrustedProxyConfig {
  enabled?: boolean;
  trustedProxyAddresses?: string[];
  forwardedHostHeader?: string;
}

export const DEFAULT_TRUSTED_PROXY_CONFIG: TrustedProxyConfig = {
  enabled: false,
  trustedProxyAddresses: [],
  forwardedHostHeader: 'x-forwarded-host',
};

function normalizeProxyAddress(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  let normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith('[')) {
    const closingBracket = normalized.indexOf(']');
    if (closingBracket > 0) {
      normalized = normalized.slice(1, closingBracket);
    }
  } else if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice('::ffff:'.length);
  }
  return normalized;
}

export function isTrustedProxyRequest(
  request: Record<string, any> | undefined,
  config: TrustedProxyConfig | undefined
): boolean {
  if (!config?.enabled || !config.trustedProxyAddresses?.length) {
    return false;
  }
  const trustedAddresses = new Set(
    config.trustedProxyAddresses
      .map((address) => normalizeProxyAddress(address))
      .filter((address): address is string => !!address)
  );
  if (trustedAddresses.size === 0) {
    return false;
  }
  const transportAddresses = [
    request?.['socket']?.remoteAddress,
    request?.['connection']?.remoteAddress,
  ].filter((address): address is string => typeof address === 'string');
  const requestAddresses =
    transportAddresses.length > 0 ? transportAddresses : [request?.['ip']];
  return (
    requestAddresses.length > 0 &&
    requestAddresses.every((address) => {
      const normalized = normalizeProxyAddress(address);
      return !!normalized && trustedAddresses.has(normalized);
    })
  );
}
