const INTERNAL_SERVER_ORIGIN = 'http://127.0.0.1:4000';

export function resolveServerApiUrl(url: string, isServer: boolean): string {
  if (!isServer) {
    return url;
  }

  if (/^https?:\/\//.test(url)) {
    return url;
  }

  if (!url.startsWith('/api/')) {
    return url;
  }

  return `${INTERNAL_SERVER_ORIGIN}${url}`;
}
