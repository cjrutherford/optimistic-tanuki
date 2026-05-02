import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppService } from './app.service';

describe('AppService.getPublicOAuthConfig', () => {
  it('merges per-domain overrides on top of global provider settings', () => {
    const config = {
      oauth: {
        google: {
          enabled: true,
          clientId: 'global-google-client',
          redirectUri: 'https://global.example.com/google/callback',
          scopes: ['openid', 'email'],
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        },
        github: {
          enabled: true,
          clientId: 'global-github-client',
          redirectUri: 'https://global.example.com/github/callback',
          scopes: ['read:user'],
          authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        },
        apps: [
          {
            domain: 'tenant.example.com',
            google: {
              clientId: 'tenant-google-client',
              redirectUri: 'https://tenant.example.com/google/callback',
            },
            github: {
              enabled: false,
            },
          },
        ],
      },
    };

    const configService = {
      get: jest.fn((path: string) => {
        const value = path
          .split('.')
          .reduce<unknown>((current, key) => (current as Record<string, unknown>)?.[key], config);
        return value;
      }),
    } as unknown as ConfigService;

    const service = new AppService(
      new Logger(),
      configService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      'jwt-secret',
      {} as never,
      {} as JwtService,
      {} as never
    );

    expect(service.getPublicOAuthConfig('tenant.example.com')).toEqual({
      google: {
        clientId: 'tenant-google-client',
        redirectUri: 'https://tenant.example.com/google/callback',
        scopes: ['openid', 'email'],
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        enabled: true,
      },
    });
  });
});
