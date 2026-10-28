import { JwtService } from '@nestjs/jwt';
import {
  issuedSessionCookieOptions,
  sessionCookieOptions,
  verifySessionToken,
} from './session-policy';
describe('rolling session transport policy', () => {
  const jwt = new JwtService({ secret: 'private-test-signing-key' });
  it('permits scoped expired signatures to reach authoritative Auth, but never other apps or bad signatures', async () => {
    const own = jwt.sign({ appId: 'client-interface' }, { expiresIn: -1 });
    expect((await verifySessionToken(jwt, own)).appId).toBe('client-interface');
    await expect(
      verifySessionToken(
        jwt,
        jwt.sign({ appId: 'another-app' }, { expiresIn: -1 })
      )
    ).rejects.toThrow();
    await expect(verifySessionToken(jwt, own + 'bad')).rejects.toThrow();
  });
  it('gives both scoped issuance and refresh cookies a seven-day rolling window', () => {
    for (const appId of ['client-interface', 'local-hub']) {
      expect(sessionCookieOptions(appId).maxAge).toBe(7 * 86400000);
      expect(issuedSessionCookieOptions(jwt.sign({ appId }))).toEqual(
        sessionCookieOptions(appId)
      );
    }
    expect(sessionCookieOptions('another-app').maxAge).toBe(3600000);
  });
});
