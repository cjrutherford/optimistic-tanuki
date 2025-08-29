import { Test, TestingModule } from '@nestjs/testing';
import { ProjectTelosService } from './project-telos.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTelos } from '../entities';

describe('ProjectTelosService', () => {
  let service: ProjectTelosService;
  let projectRepository: Repository<ProjectTelos>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectTelosService,
        {
          provide: getRepositoryToken(ProjectTelos),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<ProjectTelosService>(ProjectTelosService);
    projectRepository = module.get<Repository<ProjectTelos>>(getRepositoryToken(ProjectTelos));

    // Mock repository methods
    jest.spyOn(projectRepository, 'create').mockImplementation((entity) => Object.assign(new ProjectTelos(), entity));
    jest.spyOn(projectRepository, 'save').mockImplementation(async (entity) => entity as ProjectTelos);
    jest.spyOn(projectRepository, 'find').mockResolvedValue([]);
    jest.spyOn(projectRepository, 'findOne').mockResolvedValue(null);
    jest.spyOn(projectRepository, 'update').mockResolvedValue(undefined);
    jest.spyOn(projectRepository, 'delete').mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a project', async () => {
      const createDto = { name: 'Test Project', description: 'Test Desc', goals: [], skills: [], interests: [], limitations: [], strengths: [], objectives: [], coreObjective: 'Test Obj', overallProjectSummary: 'Summary' };
      const expectedProject = { id: '1', ...createDto };
      jest.spyOn(projectRepository, 'save').mockResolvedValue(expectedProject as ProjectTelos);

      const result = await service.create(createDto);
      expect(projectRepository.create).toHaveBeenCalledWith(createDto);
      expect(projectRepository.save).toHaveBeenCalledWith(expect.any(ProjectTelos));
      expect(result).toEqual(expectedProject);
    });
  });

  describe('findAll', () => {
    it('should return all projects', async () => {
      const expectedProjects = [{ id: '1', name: 'Test Project' }] as ProjectTelos[];
      jest.spyOn(projectRepository, 'find').mockResolvedValue(expectedProjects);

      const result = await service.findAll({});
      expect(projectRepository.find).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual(expectedProjects);
    });

    it('should filter by name', async () => {
      const expectedProjects = [{ id: '1', name: 'Test Project' }] as ProjectTelos[];
      jest.spyOn(projectRepository, 'find').mockResolvedValue(expectedProjects);

      const result = await service.findAll({ name: 'Test Project' });
      expect(projectRepository.find).toHaveBeenCalledWith({ where: { name: 'Test Project' } });
      expect(result).toEqual(expectedProjects);
    });

    it('should filter by coreObjective using Like', async () => {
      const expectedProjects = [{ id: '1', name: 'Test Project' }] as ProjectTelos[];
      jest.spyOn(projectRepository, 'find').mockResolvedValue(expectedProjects);

      const result = await service.findAll({ coreObjective: 'Test Obj' });
      expect(projectRepository.find).toHaveBeenCalledWith({ where: { coreObjective: expect.anything() } });
      expect(result).toEqual(expectedProjects);
    });
  });

  describe('findOne', () => {
    it('should return a project by id', async () => {
      const expectedProject = { id: '1', name: 'Test Project' } as ProjectTelos;
      jest.spyOn(projectRepository, 'findOne').mockResolvedValue(expectedProject);

      const result = await service.findOne('1');
      expect(projectRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(expectedProject);
    });
  });

  describe('update', () => {
    it('should update a project and return it', async () => {
      const updateDto = { name: 'Updated Project' };
      const existingProject = { id: '1', name: 'Test Project' } as ProjectTelos;
      const updatedProject = { ...existingProject, ...updateDto } as ProjectTelos;
      jest.spyOn(projectRepository, 'findOne').mockResolvedValue(updatedProject);

      const result = await service.update('1', updateDto);
      expect(projectRepository.update).toHaveBeenCalledWith('1', updateDto);
      expect(projectRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(updatedProject);
    });
  });

  describe('remove', () => {
    it('should delete a project', async () => {
      await service.remove('1');
      expect(projectRepository.delete).toHaveBeenCalledWith('1');
    });
  });
});
