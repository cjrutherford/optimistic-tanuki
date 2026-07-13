import { ConfigService } from '@nestjs/config';
import { OAuthConfigValidator } from './oauth-config.validator';

describe('OAuthConfigValidator', () => {
  it('treats authentication provider allowlisting independently of gateway secrets', () => {
    const configService = {
      get: jest.fn().mockReturnValue({
        google: { enabled: true },
        github: { enabled: false },
      }),
    } as unknown as ConfigService;
    const validator = new OAuthConfigValidator(configService);

    validator.onModuleInit();

    expect(validator.isProviderEnabled('google')).toBe(true);
    expect(validator.isProviderEnabled('github')).toBe(false);
  });
});
