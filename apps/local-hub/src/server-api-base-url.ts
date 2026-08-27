export const getServerApiBaseUrl = (gatewayUrl: string): string =>
  `${gatewayUrl.replace(/\/$/, '')}/api`;
