const FALLBACK_RETURN_URL = '/projects';

/**
 * The server-generated returnUrl must remain an in-app Angular URL.  Treat
 * malformed, protocol-relative, and external-shaped input as untrusted.
 */
export function resolveLoginReturnUrl(returnUrl: string | null): string {
  if (!returnUrl || !returnUrl.startsWith('/')) {
    return FALLBACK_RETURN_URL;
  }

  try {
    const decoded = decodeURIComponent(returnUrl);
    if (
      decoded.startsWith('//') ||
      decoded.startsWith('/\\') ||
      decoded.includes('\\') ||
      /[\r\n\0]/.test(decoded)
    ) {
      return FALLBACK_RETURN_URL;
    }
  } catch {
    return FALLBACK_RETURN_URL;
  }

  return returnUrl;
}
