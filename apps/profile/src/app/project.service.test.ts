import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectService } from './project.service';
import { Project } from '../projects/entities/project.entity';
import { CreateProjectDto } from '../projects/dto/create-project.dto';
import { UpdateProjectDto } from '../projects/dto/update-project.dto';

describe('ProjectService', () => {
    let service: ProjectService;
    let repository: Repository<Project>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProjectService,
                {
                    provide: getRepositoryToken(Project),
                    useClass: Repository,
                },
            ],
        }).compile();

        service = module.get<ProjectService>(ProjectService);
        repository = module.get<Repository<Project>>(getRepositoryToken(Project));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('should return an array of projects', async () => {
            const projects = [new Project(), new Project()];
            jest.spyOn(repository, 'find').mockResolvedValue(projects);

            expect(await service.findAll()).toBe(projects);
        });
    });

    describe('findOne', () => {
        it('should return a single project', async () => {
            const project = new Project();
            jest.spyOn(repository, 'findOne').mockResolvedValue(project);

            expect(await service.findOne('1')).toBe(project);
        });
    });

    describe('create', () => {
        it('should create a new project', async () => {
            const projectDto: CreateProjectDto = {
                name: 'Test Project',
                description: '',
                userId: '',
                timelineId: '',
                profileId: ''
            };
            const project = new Project();
            jest.spyOn(repository, 'save').mockResolvedValue(project);

            expect(await service.create(projectDto)).toBe(project);
        });
    });

    describe('update', () => {
        it('should update an existing project', async () => {
            const projectDto: UpdateProjectDto = {
                name: 'Updated Project',
                id: ''
            };
            const project = new Project();
            jest.spyOn(repository, 'update').mockResolvedValue(undefined);
            jest.spyOn(repository, 'findOne').mockResolvedValue(project);

            expect(await service.update('1', projectDto)).toBe(project);
        });
    });
});