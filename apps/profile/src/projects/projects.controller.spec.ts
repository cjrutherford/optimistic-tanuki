import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectService } from '../app/project.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [ProjectService],
    })
    .overrideProvider(ProjectService)
    .useValue({
      create : jest.fn().mockImplementation((createProject) => createProject),
      findAll : jest.fn().mockImplementation((query) => query),
      findOne : jest.fn().mockImplementation((id, query) => id),
      update : jest.fn().mockImplementation((id, updateProject) => updateProject),
    })
    .compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a project', async () => {
    const createProjectDto = { 
      name: 'Test Project',
      description: 'Test Description',
      userId: '1',
      timelineId: '1',
      profileId: '1',
    };
    expect(await controller.create(createProjectDto)).toEqual(createProjectDto);
  });

  it('should return all projects', async () => {
    const query = {};
    expect(await controller.findAll(query)).toEqual(query);
  });

  it('should return a single project', async () => {
    const id = '1';
    const query = {};
    expect(await controller.findOne(id, query)).toEqual(id);
  });

  it('should update a project', async () => {
    const id = '1';
    const updateProjectDto = { id, name: 'Updated Project' };
    expect(await controller.update(id, updateProjectDto)).toEqual(updateProjectDto);
  });
});
