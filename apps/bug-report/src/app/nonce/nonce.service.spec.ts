import { NonceService } from './nonce.service';

describe('NonceService', () => {
  it('issues single-use nonce that expires on reuse', async () => {
    const svc = new NonceService();
    const { nonce, expiresAt } = await svc.issue('1.2.3.4');
    expect(nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
    await expect(svc.consume(nonce, '1.2.3.4')).resolves.toBe(true);
    await expect(svc.consume(nonce, '1.2.3.4')).rejects.toThrow(/invalid/i);
  });

  it('rejects nonce from different IP', async () => {
    const svc = new NonceService(300_000);
    const { nonce } = await svc.issue('1.1.1.1');
    await expect(svc.consume(nonce, '2.2.2.2')).rejects.toThrow();
  });

  it('rejects expired nonce', async () => {
    const svc = new NonceService(1); // 1ms TTL
    const { nonce } = await svc.issue('9.9.9.9');
    await new Promise((r) => setTimeout(r, 5));
    await expect(svc.consume(nonce, '9.9.9.9')).rejects.toThrow(/expired/i);
  });
});
