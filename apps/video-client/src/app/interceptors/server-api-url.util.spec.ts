describe('resolveServerApiUrl', () => {
  it('rewrites relative api urls to the internal server origin during SSR', async () => {
    const { resolveServerApiUrl } = await import('./server-api-url.util');

    expect(resolveServerApiUrl('/api/videos/trending?limit=10', true)).toBe(
      'http://127.0.0.1:4000/api/videos/trending?limit=10',
    );
  });

  it('leaves relative api urls unchanged in the browser', async () => {
    const { resolveServerApiUrl } = await import('./server-api-url.util');

    expect(resolveServerApiUrl('/api/videos/trending?limit=10', false)).toBe(
      '/api/videos/trending?limit=10',
    );
  });

  it('leaves absolute urls unchanged during SSR', async () => {
    const { resolveServerApiUrl } = await import('./server-api-url.util');

    expect(
      resolveServerApiUrl(
        'http://127.0.0.1:8089/api/videos/trending?limit=10',
        true,
      ),
    ).toBe('http://127.0.0.1:8089/api/videos/trending?limit=10');
  });
});
