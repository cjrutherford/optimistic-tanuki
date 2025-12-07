import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsProxyService } from './permissions-proxy.service';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';

describe('PermissionsProxyService', () => {
  let service: PermissionsProxyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsProxyService,
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of({})),
          },
        },
      ],
    }).compile();

    service = module.get<PermissionsProxyService>(PermissionsProxyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
