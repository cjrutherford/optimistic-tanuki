import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { of, Subject } from 'rxjs';
import { SocketSessionAuthService } from './socket-session-auth.service';
import { ChatGateway } from '../app/chat-gateway/chat.gateway';
import { SocialGateway } from '../app/social-gateway/social.gateway';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

const account = randomUUID();
const other = randomUUID();
function socket() {
  const events = new EventEmitter();
  const s = {
    data: {} as Record<string, unknown>,
    handshake: {
      headers: {
        cookie: 'ot_session=PRIVATE_COOKIE',
        authorization: 'Bearer PRIVATE_HEADER',
      },
      auth: { token: 'PRIVATE_TOKEN' },
    },
    request: {
      headers: {
        cookie: 'ot_session=PRIVATE_REQUEST_COOKIE',
        authorization: 'Bearer PRIVATE_REQUEST_HEADER',
      },
    },
    once: events.once.bind(events),
    disconnect: jest.fn(() => events.emit('disconnect')),
    join: jest.fn(async () => {}),
    emit: jest.fn(),
  };
  return s;
}
function fixture() {
  const jwt = {
    verifyAsync: jest.fn(async () => ({
      userId: account,
      profileId: randomUUID(),
    })),
  };
  const auth = { send: jest.fn(() => of({ isValid: true })) };
  const service = new SocketSessionAuthService(
    jwt as never,
    auth as never,
    { apps: [] } as never
  );
  return { jwt, auth, service };
}

it('disconnects only the target account, clears owned credentials and rejects late sockets', async () => {
  const { jwt, service } = fixture();
  const own = socket(),
    foreign = socket();
  await service.authenticate(own as never);
  jwt.verifyAsync.mockResolvedValueOnce({
    userId: other,
    profileId: randomUUID(),
  });
  await service.authenticate(foreign as never);
  await expect(service.purgeAccount(account)).resolves.toEqual({
    remaining: 0,
  });
  expect(own.emit).toHaveBeenCalledWith('account_deleted', {
    accountId: account,
  });
  expect(own.emit.mock.invocationCallOrder[0]).toBeLessThan(
    own.disconnect.mock.invocationCallOrder[0]
  );
  expect(own.disconnect).toHaveBeenCalledWith(true);
  expect(own.data).toEqual({ deletionPurged: true });
  expect(own.handshake.headers).toEqual({});
  expect(own.handshake.auth).toEqual({});
  expect(own.request.headers).toEqual({});
  expect(foreign.disconnect).not.toHaveBeenCalled();
  expect(service.getUser(foreign as never).userId).toBe(other);
  const late = socket();
  await expect(service.authenticate(late as never)).rejects.toThrow(
    'Unauthorized socket connection'
  );
  expect(late.data).toEqual({ deletionPurged: true });
  expect(await service.readbackAccount(account)).toBe(0);
});
it.each([true, false])(
  'drains an in-flight validation and refuses late state (valid=%s)',
  async (isValid) => {
    const { auth, service } = fixture();
    const response = new Subject<{ isValid: boolean }>();
    auth.send.mockReturnValueOnce(response);
    const own = socket();
    const authentication = service.authenticate(own as never);
    const rejected = expect(authentication).rejects.toThrow(
      'Unauthorized socket connection'
    );
    await Promise.resolve(); // JWT resolves and the real validation observable is subscribed.
    let purged = false;
    const purge = service.purgeAccount(account).then(() => {
      purged = true;
    });
    await Promise.resolve();
    expect(purged).toBe(false);
    response.next({ isValid });
    response.complete();
    await rejected;
    await purge;
    expect(own.data).toEqual({ deletionPurged: true });
    expect(await service.readbackAccount(account)).toBe(0);
  }
);
it('requires a deletion fence and valid account domain; failed disconnect remains retriable', async () => {
  const { service } = fixture();
  await expect(service.readbackAccount(account)).rejects.toThrow(
    'SOCKET_DELETION_FENCE_REQUIRED'
  );
  await expect(
    service.purgeAccount('00000000-0000-0000-0000-000000000000')
  ).rejects.toThrow('SOCKET_DELETION_ACCOUNT_INVALID');
  const own = socket();
  await service.authenticate(own as never);
  own.disconnect.mockImplementationOnce(() => {
    throw Error('DISCONNECT_FAILED');
  });
  await expect(service.purgeAccount(account)).rejects.toThrow(
    'DISCONNECT_FAILED'
  );
  expect(await service.readbackAccount(account)).toBe(1);
  // A failed transport close must be retried even though identity/credentials are already cleared.
  await expect(service.purgeAccount(account)).resolves.toEqual({
    remaining: 0,
  });
  expect(own.disconnect).toHaveBeenCalledTimes(2);
});
it('prevents gateway registration after a resolved authentication/join resumes following deletion', async () => {
  const { service } = fixture();
  const own = socket();
  const joined = new Subject<void>();
  own.join.mockImplementationOnce(
    () => new Promise<void>((resolve) => joined.subscribe(() => resolve()))
  );
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
  const proxy = { send: jest.fn() };
  const chat = new ChatGateway(
    logger as never,
    proxy as never,
    proxy as never,
    proxy as never,
    proxy as never,
    proxy as never,
    service
  );
  const connecting = chat.handleConnection(own as never);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await service.purgeAccount(account);
  joined.next();
  joined.complete();
  await connecting;
  expect((chat as any).connectedClients).toEqual([]);
  const social = new SocialGateway(proxy as never, service, {} as never);
  expect(() =>
    (social as any).registerClient(randomUUID(), own, account)
  ).toThrow('Socket session unavailable');
  expect((social as any).connectedClients.size).toBe(0);
});
