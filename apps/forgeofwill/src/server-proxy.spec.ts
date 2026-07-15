import { createSocketIoProxyOptions } from './server-proxy';

describe('createSocketIoProxyOptions', () => {
  it('preserves the socket.io engine path when proxying browser websocket traffic', () => {
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
