import { createApiProxyOptions } from './server-proxy';

describe('createApiProxyOptions', () => {
  it('preserves the browser host and API path for gateway app-origin authorization', () => {
    const options = createApiProxyOptions('http://gateway:3000');

    expect(options).toEqual(
      expect.objectContaining({
        target: 'http://gateway:3000',
        changeOrigin: false,
        ws: true,
      })
    );
    expect(typeof options.pathRewrite).toBe('function');
    if (typeof options.pathRewrite === 'function') {
      expect(
        options.pathRewrite('/authentication/register', {
          originalUrl: '/api/authentication/register',
        } as any)
      ).toBe('/api/authentication/register');
    }
  });
});
