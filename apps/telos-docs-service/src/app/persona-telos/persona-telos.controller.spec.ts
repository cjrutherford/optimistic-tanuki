import { Test, TestingModule } from '@nestjs/testing';
import { PersonaTelosController } from './persona-telos.controller';

describe('PersonalTelosController', () => {
  let controller: PersonaTelosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonaTelosController],
    }).compile();

    controller = module.get<PersonaTelosController>(PersonaTelosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
