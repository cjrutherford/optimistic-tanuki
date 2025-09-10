import { Test, TestingModule } from '@nestjs/testing';
import { PersonaTelosController } from './persona-telos.controller';
import { PersonaTelosService } from './persona-telos.service';
import { PersonaTelosCommands } from '@optimistic-tanuki/constants';

describe('PersonaTelosController', () => {
  let controller: PersonaTelosController;
  let service: PersonaTelosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonaTelosController],
      providers: [
        {
          provide: PersonaTelosService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PersonaTelosController>(PersonaTelosController);
    service = module.get<PersonaTelosService>(PersonaTelosService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with the provided data', async () => {
      const createDto = { name: 'Test Persona' } as any;
      await controller.create(createDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('update', () => {
    it('should call service.update with the provided data', async () => {
      const updateDto = { id: '1', name: 'Updated Persona' } as any;
      await controller.update(updateDto);
      expect(service.update).toHaveBeenCalledWith(updateDto.id, updateDto);
    });
  });

  describe('delete', () => {
    it('should call service.remove with the provided id', async () => {
      const id = '1';
      await controller.delete(id);
      expect(service.remove).toHaveBeenCalledWith(id);
    });
  });

  describe('find', () => {
    it('should call service.findAll with the provided query', async () => {
      const query = { name: 'Test' } as any;
      await controller.find(query);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with the provided id', async () => {
      const id = '1';
      await controller.findOne({ id });
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });
});
