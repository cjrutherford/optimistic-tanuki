import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsProxyService } from './permissions-proxy.service';

describe('PermissionsProxyService', () => {
  let service: PermissionsProxyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsProxyService],
    }).compile();

    service = module.get<PermissionsProxyService>(PermissionsProxyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
