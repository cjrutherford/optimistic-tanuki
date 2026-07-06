import {
  createApiProxyOptions,
  createSocketIoProxyOptions,
} from './server-proxy';

describe('createApiProxyOptions', () => {
  it('preserves the original host header for gateway browser-origin checks', () => {
    expect(createApiProxyOptions('http://gateway:3000')).toEqual(
      expect.objectContaining({
        target: 'http://gateway:3000/api',
        changeOrigin: false,
        xfwd: true,
      })
    );
  });
});

describe('createSocketIoProxyOptions', () => {
  it('preserves the socket.io engine path when proxying websocket traffic', () => {
    expect(createSocketIoProxyOptions('http://gateway:3300')).toEqual(
      expect.objectContaining({
        target: 'http://gateway:3300/socket.io',
        ws: true,
        changeOrigin: true,
        xfwd: true,
      })
    );
  });
});
