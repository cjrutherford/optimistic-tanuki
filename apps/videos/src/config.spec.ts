describe('loadConfig', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
    jest.resetModules();
  });

  it('uses PORT from the environment when present', async () => {
    process.env.PORT = '3019';

    const { default: loadConfig } = await import('./config');

    expect(loadConfig().listenPort).toBe(3019);
  });
});
