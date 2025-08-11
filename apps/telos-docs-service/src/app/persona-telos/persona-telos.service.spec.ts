import { Test, TestingModule } from '@nestjs/testing';
import { PersonaTelosService } from './persona-telos.service';

describe('PersonaTelosService', () => {
  let service: PersonaTelosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PersonaTelosService],
    }).compile();

    service = module.get<PersonaTelosService>(PersonaTelosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
