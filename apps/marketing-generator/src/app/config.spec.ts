describe('marketing generator config', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    jest.resetModules();
  });

  it('defaults to prompt-proxy ollama settings from config', async () => {
    const module = await import('./config');
    const config = module.loadConfig();

    expect(config.ollama.host).toBe('prompt-proxy');
    expect(config.ollama.port).toBe(11434);
    expect(config.ollama.model).toBe('gemma3');
    expect(config.ollama.timeoutMs).toBe(120000);
  });

  it('allows env overrides using the lead-tracker variable names', async () => {
    process.env.OLLAMA_HOST = 'localhost';
    process.env.OLLAMA_PORT = '9999';
    process.env.OLLAMA_MODEL = 'llama3.2:3b';
    process.env.OLLAMA_TEMPERATURE = '0.7';
    process.env.OLLAMA_TIMEOUT_MS = '60000';

    const module = await import('./config');
    const config = module.loadConfig();

    expect(config.ollama.host).toBe('localhost');
    expect(config.ollama.port).toBe(9999);
    expect(config.ollama.model).toBe('llama3.2:3b');
    expect(config.ollama.temperature).toBe(0.7);
    expect(config.ollama.timeoutMs).toBe(60000);
  });
});
