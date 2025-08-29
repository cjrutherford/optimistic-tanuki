import { Test, TestingModule } from '@nestjs/testing';
import { PersonaTelosService } from './persona-telos.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonaTelos } from '../entities';
import { Logger } from '@nestjs/common';

describe('PersonaTelosService', () => {
  let service: PersonaTelosService;
  let personaRepository: Repository<PersonaTelos>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonaTelosService,
        {
          provide: getRepositoryToken(PersonaTelos),
          useClass: Repository,
        },
        {
          provide: Logger,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PersonaTelosService>(PersonaTelosService);
    personaRepository = module.get<Repository<PersonaTelos>>(getRepositoryToken(PersonaTelos));

    // Mock repository methods
    jest.spyOn(personaRepository, 'create').mockImplementation((entity) => Object.assign(new PersonaTelos(), entity));
    jest.spyOn(personaRepository, 'save').mockImplementation(async (entity) => entity as PersonaTelos);
    jest.spyOn(personaRepository, 'find').mockResolvedValue([]);
    jest.spyOn(personaRepository, 'findOne').mockResolvedValue(null);
    jest.spyOn(personaRepository, 'update').mockResolvedValue(undefined);
    jest.spyOn(personaRepository, 'delete').mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a persona', async () => {
      const createDto = { name: 'Test Persona', description: 'Test Desc', goals: [], skills: [], interests: [], limitations: [], strengths: [], objectives: [], coreObjective: 'Test Obj', exampleResponses: [], promptTemplate: 'Test Template' };
      const expectedPersona = { id: '1', ...createDto };
      jest.spyOn(personaRepository, 'save').mockResolvedValue(expectedPersona as PersonaTelos);

      const result = await service.create(createDto);
      expect(personaRepository.create).toHaveBeenCalledWith(createDto);
      expect(personaRepository.save).toHaveBeenCalledWith(expect.any(PersonaTelos));
      expect(result).toEqual(expectedPersona);
    });
  });

  describe('findAll', () => {
    it('should return all personas', async () => {
      const expectedPersonas = [{ id: '1', name: 'Test Persona' }] as PersonaTelos[];
      jest.spyOn(personaRepository, 'find').mockResolvedValue(expectedPersonas);

      const result = await service.findAll({});
      expect(personaRepository.find).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual(expectedPersonas);
    });

    it('should filter by name', async () => {
      const expectedPersonas = [{ id: '1', name: 'Test Persona' }] as PersonaTelos[];
      jest.spyOn(personaRepository, 'find').mockResolvedValue(expectedPersonas);

      const result = await service.findAll({ name: 'Test Persona' });
      expect(personaRepository.find).toHaveBeenCalledWith({ where: { name: 'Test Persona' } });
      expect(result).toEqual(expectedPersonas);
    });

    it('should filter by id', async () => {
      const expectedPersonas = [{ id: '1', name: 'Test Persona' }] as PersonaTelos[];
      jest.spyOn(personaRepository, 'find').mockResolvedValue(expectedPersonas);

      const result = await service.findAll({ id: '1' });
      expect(personaRepository.find).toHaveBeenCalledWith({ where: { id: expect.anything() } });
      expect(result).toEqual(expectedPersonas);
    });

    it('should filter by coreObjective using Like', async () => {
      const expectedPersonas = [{ id: '1', name: 'Test Persona' }] as PersonaTelos[];
      jest.spyOn(personaRepository, 'find').mockResolvedValue(expectedPersonas);

      const result = await service.findAll({ coreObjective: 'Test Obj' });
      expect(personaRepository.find).toHaveBeenCalledWith({ where: { coreObjective: expect.anything() } });
      expect(result).toEqual(expectedPersonas);
    });
  });

  describe('findOne', () => {
    it('should return a persona by id', async () => {
      const expectedPersona = { id: '1', name: 'Test Persona' } as PersonaTelos;
      jest.spyOn(personaRepository, 'findOne').mockResolvedValue(expectedPersona);

      const result = await service.findOne('1');
      expect(personaRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(expectedPersona);
    });
  });

  describe('update', () => {
    it('should update a persona and return it', async () => {
      const updateDto = { name: 'Updated Persona' };
      const existingPersona = { id: '1', name: 'Test Persona' } as PersonaTelos;
      const updatedPersona = { ...existingPersona, ...updateDto } as PersonaTelos;
      jest.spyOn(personaRepository, 'findOne').mockResolvedValue(updatedPersona);

      const result = await service.update('1', updateDto);
      expect(personaRepository.update).toHaveBeenCalledWith('1', updateDto);
      expect(personaRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(updatedPersona);
    });
  });

  describe('remove', () => {
    it('should delete a persona', async () => {
      await service.remove('1');
      expect(personaRepository.delete).toHaveBeenCalledWith('1');
    });
  });
});
