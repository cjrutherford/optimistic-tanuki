import { Test, TestingModule } from '@nestjs/testing';
import { ProjectTelosController } from './project-telos.controller';
import { ProjectTelosService } from './project-telos.service';

describe('ProjectTelosController', () => {
  let controller: ProjectTelosController;
  let service: ProjectTelosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectTelosController],
      providers: [
        {
          provide: ProjectTelosService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findOne: jest.fn(),
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProjectTelosController>(ProjectTelosController);
    service = module.get<ProjectTelosService>(ProjectTelosService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with the provided data', async () => {
      const createDto = { name: 'Test Project' } as any;
      await controller.create(createDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('update', () => {
    it('should call service.update with the provided data', async () => {
      const updateDto = { id: '1', name: 'Updated Project' } as any;
      await controller.update(updateDto);
      expect(service.update).toHaveBeenCalledWith(updateDto.id, updateDto);
    });
  });

  describe('remove', () => {
    it('should call service.remove with the provided id', async () => {
      const id = '1';
      await controller.remove(id);
      expect(service.remove).toHaveBeenCalledWith(id);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with the provided id', async () => {
      const id = '1';
      await controller.findOne(id);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with the provided query', async () => {
      const query = { name: 'Test' } as any;
      await controller.findAll(query);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });
});
