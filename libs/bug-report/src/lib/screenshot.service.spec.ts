import { ScreenshotService } from './screenshot.service';

describe('ScreenshotService', () => {
  it('returns dataUrl within limit, lowering quality when oversized', async () => {
    let calls = 0;
    const renderer = async () => {
      calls++;
      const size = calls === 1 ? 3_000_000 : 100;
      return {
        toDataURL: () => `data:image/jpeg;base64,${'A'.repeat(size)}`,
        width: 10,
        height: 10,
      };
    };
    const svc = new ScreenshotService(renderer as any);
    const url = await svc.capture();
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(url.length).toBeLessThanOrEqual(2_000_000);
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
