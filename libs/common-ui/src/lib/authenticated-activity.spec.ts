import { watchAuthenticatedActivity } from './authenticated-activity';
describe('authenticated activity cookie refresh', () => {
  it('refreshes only trusted input while signed in, without an idle heartbeat', () => {
    let listener: EventListener = () => undefined;
    let now = 0;
    let authenticated = false;
    const target = {
      addEventListener: jest.fn((_event: string, fn: EventListener) => {
        listener = fn;
      }),
      removeEventListener: jest.fn(),
    };
    const refresh = jest.fn().mockResolvedValue(undefined);
    const stop = watchAuthenticatedActivity(
      () => authenticated,
      refresh,
      target,
      () => now
    );
    now = 60 * 60 * 1000;
    listener({ isTrusted: true } as Event);
    expect(refresh).not.toHaveBeenCalled();
    authenticated = true;
    listener({ isTrusted: false } as Event);
    expect(refresh).not.toHaveBeenCalled();
    listener({ isTrusted: true } as Event);
    expect(refresh).toHaveBeenCalledTimes(1);
    now += 1000;
    listener({ isTrusted: true } as Event);
    expect(refresh).toHaveBeenCalledTimes(1);
    stop();
    expect(target.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
