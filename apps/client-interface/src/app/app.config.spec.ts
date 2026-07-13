import { SOCKET_HOST, SOCKET_PATH } from '@optimistic-tanuki/chat-ui';
import { appConfig } from './app.config';

type FactoryProvider = {
  provide: unknown;
  useFactory?: () => string;
};

describe('appConfig socket host', () => {
  it('defaults chat sockets to the same origin when no override is present', () => {
    const socketHostProvider = (appConfig.providers as FactoryProvider[]).find(
      (provider) => provider.provide === SOCKET_HOST
    );

    expect(socketHostProvider?.useFactory).toBeDefined();

    const originalEnv = (window as Window & { env?: { SOCKET_URL?: string } })
      .env;
    delete (window as Window & { env?: { SOCKET_URL?: string } }).env;

    expect(socketHostProvider?.useFactory?.()).toBe('');

    (window as Window & { env?: { SOCKET_URL?: string } }).env = originalEnv;
  });

  it('uses the runtime Socket.IO transport path override', () => {
    const socketPathProvider = (appConfig.providers as FactoryProvider[]).find(
      (provider) => provider.provide === SOCKET_PATH
    );

    const originalEnv = (window as Window & { env?: { SOCKET_PATH?: string } })
      .env;
    (window as Window & { env?: { SOCKET_PATH?: string } }).env = {
      SOCKET_PATH: '/ws',
    };

    expect(socketPathProvider?.useFactory?.()).toBe('/ws');

    (window as Window & { env?: { SOCKET_PATH?: string } }).env = originalEnv;
  });
});
