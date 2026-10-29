const appOrigin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const parsedAppOrigin = new URL(appOrigin);

/** Application identity headers required for app-scoped gateway requests. */
export const clientInterfaceHeaders = {
  'X-ot-app-id': 'client-interface',
  'X-ot-appscope': 'client-interface',
  Origin: parsedAppOrigin.origin,
  Host: parsedAppOrigin.host,
};

export { appOrigin };
