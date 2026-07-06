import { SOCKET_HOST } from '@optimistic-tanuki/chat-ui';
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
});
