import { of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { UpworkApiService } from './upwork-api.service';

describe('UpworkApiService', () => {
  let service: UpworkApiService;
  let httpService: { post: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = {
      post: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue({
        mode: 'api',
        clientId: 'upwork-client-id',
        clientSecret: 'upwork-client-secret',
        grantType: 'client_credentials',
        graphqlUrl: 'https://api.upwork.com/graphql',
        tokenUrl: 'https://www.upwork.com/api/v3/oauth2/token',
        searchLimit: 5,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpworkApiService,
        {
          provide: HttpService,
          useValue: httpService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get(UpworkApiService);
  });

  it('returns a configuration warning when no GraphQL query document is configured', async () => {
    const result = await service.searchJobs(['react', 'dashboard']);

    expect(result.jobs).toEqual([]);
    expect(result.warnings).toContain(
      'Upwork API mode is enabled, but no GraphQL search query is configured. Set leadDiscovery.upwork.searchQueryDocument to an approved Upwork job search query that accepts query and limit variables.'
    );
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('fetches an OAuth token and normalizes GraphQL job nodes', async () => {
    configService.get.mockReturnValue({
      mode: 'api',
      clientId: 'upwork-client-id',
      clientSecret: 'upwork-client-secret',
      grantType: 'client_credentials',
      graphqlUrl: 'https://api.upwork.com/graphql',
      tokenUrl: 'https://www.upwork.com/api/v3/oauth2/token',
      searchLimit: 5,
      tenantId: 'org-123',
      searchQueryDocument: 'query SearchJobs($query: String!, $limit: Int!) { marketplaceJobPostSearch(query: $query, limit: $limit) { edges { node { id title description jobUrl skills { name } client { companyName } } } } }',
    });
    httpService.post
      .mockReturnValueOnce(
        of({
          data: {
            access_token: 'upwork-access-token',
            expires_in: 3600,
          },
        })
      )
      .mockReturnValueOnce(
        of({
          data: {
            data: {
              marketplaceJobPostSearch: {
                edges: [
                  {
                    node: {
                      id: 'job-123',
                      title: 'React Dashboard Developer',
                      description: 'Build a React analytics dashboard for a SaaS client.',
                      jobUrl: 'https://www.upwork.com/jobs/~0123456789abcdef',
                      skills: [{ name: 'React' }, { name: 'Dashboard' }],
                      client: { companyName: 'Acme Health' },
                    },
                  },
                ],
              },
            },
          },
        })
      );

    const result = await service.searchJobs(['react', 'dashboard']);

    expect(httpService.post).toHaveBeenNthCalledWith(
      1,
      'https://www.upwork.com/api/v3/oauth2/token',
      'grant_type=client_credentials&client_id=upwork-client-id&client_secret=upwork-client-secret',
      expect.objectContaining({
        headers: expect.objectContaining({
          'content-type': 'application/x-www-form-urlencoded',
        }),
      })
    );
    expect(httpService.post).toHaveBeenNthCalledWith(
      2,
      'https://api.upwork.com/graphql',
      {
        query: expect.stringContaining('marketplaceJobPostSearch'),
        variables: {
          query: 'react dashboard',
          limit: 5,
        },
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer upwork-access-token',
          'X-Upwork-API-TenantId': 'org-123',
        }),
      })
    );
    expect(result.warnings).toEqual([]);
    expect(result.jobs).toEqual([
      expect.objectContaining({
        id: 'job-123',
        title: 'React Dashboard Developer',
        clientCompany: 'Acme Health',
        skills: ['React', 'Dashboard'],
      }),
    ]);
  });
});