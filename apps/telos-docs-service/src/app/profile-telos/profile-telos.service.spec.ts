import { Test, TestingModule } from '@nestjs/testing';
import { ProfileTelosService } from './profile-telos.service';

describe('ProfileTelosService', () => {
  let service: ProfileTelosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfileTelosService],
    }).compile();

    service = module.get<ProfileTelosService>(ProfileTelosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
