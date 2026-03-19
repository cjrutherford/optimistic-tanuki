export async function waitForServices(): Promise<void> {
  const baseUrl = process.env['BASE_URL'] || 'http://localhost:8087';
  const maxRetries = 30;
  const retryInterval = 2000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        console.log('Frontend service is ready');
        return;
      }
    } catch {
      // Service not ready yet
    }
    console.log(`Waiting for frontend service... (${i + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, retryInterval));
  }
  throw new Error('Frontend service failed to start');
}

export async function waitForApi(): Promise<void> {
  const gatewayUrl = process.env['GATEWAY_URL'] || 'http://localhost:3000';
  const maxRetries = 30;
  const retryInterval = 2000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${gatewayUrl}/api/mcp/sse`, {
        method: 'HEAD',
      });
      if (response.ok || response.status === 405) {
        console.log('Gateway API is ready');
        return;
      }
    } catch {
      // Service not ready yet
    }
    console.log(`Waiting for gateway API... (${i + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, retryInterval));
  }
  throw new Error('Gateway API failed to start');
}

export function getBaseUrl(): string {
  return process.env['BASE_URL'] || 'http://localhost:8087';
}

export function getGatewayUrl(): string {
  return process.env['GATEWAY_URL'] || 'http://localhost:3000';
}
