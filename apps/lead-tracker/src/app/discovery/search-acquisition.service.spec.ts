import { of } from 'rxjs';
import { SearchAcquisitionService } from './search-acquisition.service';

describe('SearchAcquisitionService', () => {
  it('falls back to duckduckgo html when google html returns no usable results', async () => {
    const httpService = {
      get: jest
        .fn()
        .mockReturnValueOnce(
          of({
            data: '<html><body><div>No results</div></body></html>',
          })
        )
        .mockReturnValueOnce(
          of({
            data: `
              <html>
                <body>
                  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fjobs%2F123">
                    Senior React Engineer
                  </a>
                </body>
              </html>
            `,
          })
        ),
    };
    const configService = {
      get: jest.fn().mockReturnValue({
        enabled: true,
        provider: 'google-html',
        requestTimeoutMs: 5000,
        userAgent: 'OptimisticTanukiLeadDiscovery/1.0',
        maxResultsPerQuery: 8,
        maxQueriesPerProvider: 6,
        locale: 'en-US',
      }),
    };

    const service = new SearchAcquisitionService(
      httpService as any,
      configService as any
    );

    const results = await service.searchWeb('site:indeed.com/viewjob react');

    expect(httpService.get).toHaveBeenNthCalledWith(
      2,
      'https://html.duckduckgo.com/html/',
      expect.objectContaining({
        params: expect.objectContaining({
          q: 'site:indeed.com/viewjob react',
        }),
      })
    );
    expect(results).toEqual([
      expect.objectContaining({
        title: 'Senior React Engineer',
        url: 'https://example.com/jobs/123',
      }),
    ]);
  });
});
