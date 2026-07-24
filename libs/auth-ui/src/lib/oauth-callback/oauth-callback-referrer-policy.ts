/**
 * Applies the stricter policy only to the document that receives OAuth
 * callback query parameters. The callback component then immediately removes
 * those parameters from history before redeeming the one-time callback code.
 *
 * Structural request/response types keep this helper usable by every Express
 * host without making the browser-facing auth UI library depend on Express.
 */
export function oauthCallbackReferrerPolicy(
  request: { path: string },
  response: { setHeader(name: string, value: string): void },
  next: () => void
): void {
  if (request.path.replace(/\/+$/, '') === '/oauth/callback') {
    response.setHeader('Referrer-Policy', 'no-referrer');
  }

  next();
}
