import { Test, TestingModule } from '@nestjs/testing';
import { ProjectPlanningController } from './project-planning.controller';
import {
  ChangeCommands,
  ProjectCommands,
  ProjectJournalCommands,
  RiskCommands,
  ServiceTokens,
  TaskCommands,
  TimerCommands,
} from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import {
  CreateChangeDto,
  CreateProjectDto,
  CreateProjectJournalDto,
  CreateRiskDto,
  CreateTaskDto,
  CreateTimerDto,
  QueryChangeDto,
  QueryProjectDto,
  QueryProjectJournalDto,
  QueryRiskDto,
  QueryTaskDto,
  UpdateChangeDto,
  UpdateProjectDto,
  UpdateProjectJournalDto,
  UpdateRiskDto,
  UpdateTaskDto,
  UpdateTimerDto,
  RiskImpact,
  RiskLikelihood,
  RiskStatus,
  Changetype,
  ChangeStatus,
  TaskStatus,
  TaskPriority,
} from '@optimistic-tanuki/models';
import { UserDetails } from '../../decorators/user.decorator';

describe('ProjectPlanningController', () => {
  let controller: ProjectPlanningController;
  let projectPlanningService: any;

  const mockUser: UserDetails = {
    userId: 'user-id',
    profileId: 'profile-id',
    email: 'test@example.com',
    name: 'Test User',
    exp: 1234567890,
    iat: 1234567890,
  };

  beforeEach(async () => {
    projectPlanningService = {
      send: jest.fn().mockImplementation(() => of({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectPlanningController],
      providers: [
        {
          provide: ServiceTokens.PROJECT_PLANNING_SERVICE,
          useValue: projectPlanningService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => of(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => of(true) })
      .compile();

    controller = module.get<ProjectPlanningController>(
      ProjectPlanningController
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should find a project by id', async () => {
    await controller.findProjectById('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.FIND_ONE },
      { id: '1' }
    );
  });

  it('should find all projects', async () => {
    await controller.findAllProjects();
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.FIND_ALL },
      {}
    );
  });

  it('should query projects', async () => {
    const query: QueryProjectDto = { name: 'Test' };
    await controller.queryProjects(query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.FIND_ALL },
      query
    );
  });

  it('should create a project', async () => {
    const createDto: CreateProjectDto = {
      name: 'Test',
      description: 'Test',
      owner: 'owner-id',
      createdBy: 'creator-id',
      members: [],
      status: 'Not Started',
      startDate: new Date(),
    };
    await controller.createProject(mockUser, createDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.CREATE },
      { ...createDto, createdBy: mockUser.profileId }
    );
  });

  it('should update a project', async () => {
    const updateDto: UpdateProjectDto = { id: '1', name: 'Test' };
    await controller.updateProject(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId }
    );
  });

  it('should delete a project', async () => {
    await controller.deleteProject('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.DELETE },
      { id: '1' }
    );
  });

  it('should find a change by id', async () => {
    await controller.findChangeById('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.FIND_ONE },
      { id: '1' }
    );
  });

  it('should find all changes', async () => {
    await controller.findAllChanges();
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.FIND_ALL },
      {}
    );
  });

  it('should query changes', async () => {
    const query: QueryChangeDto = { changeDescription: 'Test' };
    await controller.queryChanges(query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.FIND_ALL },
      query
    );
  });

  it('should create a change', async () => {
    const createDto: CreateChangeDto = {
      changeType: Changetype.ADDITION,
      changeDescription: 'Test',
      changeStatus: ChangeStatus.PENDING,
      changeDate: new Date(),
      requestor: 'requestor-id',
      approver: 'approver-id',
      projectId: '1',
    };
    await controller.createChange(mockUser, createDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.CREATE },
      { ...createDto, createdBy: mockUser.profileId }
    );
  });

  it('should update a change', async () => {
    const updateDto: UpdateChangeDto = { id: '1' };
    await controller.updateChange(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId }
    );
  });

  it('should delete a change', async () => {
    await controller.deleteChange('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.REMOVE },
      { id: '1' }
    );
  });

  it('should find a journal by id', async () => {
    await controller.findJournalById('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.FIND_ONE },
      { id: '1' }
    );
  });

  it('should find all journals', async () => {
    await controller.findAllJournals();
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.FIND_ALL },
      {}
    );
  });

  it('should query journals', async () => {
    const query: QueryProjectJournalDto = { content: 'Test' };
    await controller.queryJournals(query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.FIND_ALL },
      query
    );
  });

  it('should create a journal', async () => {
    const createDto: CreateProjectJournalDto = {
      profileId: 'profile-id',
      content: 'Test',
      projectId: '1',
    };
    await controller.createJournal(mockUser, createDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.CREATE },
      { ...createDto, createdBy: mockUser.profileId }
    );
  });

  it('should update a journal', async () => {
    const updateDto: UpdateProjectJournalDto = { id: '1' };
    await controller.updateJournal(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId }
    );
  });

  it('should delete a journal', async () => {
    await controller.deleteJournal('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.REMOVE },
      { id: '1' }
    );
  });

  it('should find a risk by id', async () => {
    await controller.findRiskById('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.FIND_ONE },
      { id: '1' }
    );
  });

  it('should find all risks', async () => {
    await controller.findAllRisks();
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.FIND_ALL },
      {}
    );
  });

  it('should query risks', async () => {
    const query: QueryRiskDto = { name: 'Test' };
    await controller.queryRisks(query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.FIND_ALL },
      query
    );
  });

  it('should create a risk', async () => {
    const createDto: CreateRiskDto = {
      name: 'Test',
      description: 'Test',
      projectId: '1',
      riskOwner: 'owner-id',
      likelihood: RiskLikelihood.POSSIBLE,
      impact: RiskImpact.LOW,
      status: RiskStatus.OPEN,
    };
    await controller.createRisk(mockUser, createDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.CREATE },
      { ...createDto, createdBy: mockUser.profileId }
    );
  });

  it('should update a risk', async () => {
    const updateDto: UpdateRiskDto = { id: '1', name: 'Test' };
    await controller.updateRisk(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId }
    );
  });

  it('should delete a risk', async () => {
    await controller.deleteRisk('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.DELETE },
      { id: '1' }
    );
  });

  it('should find a task by id', async () => {
    await controller.findTaskById('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.FIND_ONE },
      { id: '1' }
    );
  });

  it('should find all tasks', async () => {
    await controller.findAllTasks();
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.FIND_ALL },
      {}
    );
  });

  it('should query tasks', async () => {
    const query: QueryTaskDto = { title: 'Test' };
    await controller.queryTasks(query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.FIND_ALL },
      query
    );
  });

  it('should create a task', async () => {
    const createDto: CreateTaskDto = {
      title: 'Test',
      description: 'Test',
      projectId: '1',
      createdBy: 'creator-id',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
    };
    await controller.createTask(mockUser, createDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.CREATE },
      { ...createDto, createdBy: mockUser.profileId }
    );
  });

  it('should update a task', async () => {
    const updateDto: UpdateTaskDto = { id: '1', title: 'Test' };
    await controller.updateTask(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId }
    );
  });

  it('should delete a task', async () => {
    await controller.deleteTask('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.DELETE },
      { id: '1' }
    );
  });

  it('should find a timer by id', async () => {
    await controller.findTimerById('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.FIND_ONE },
      { id: '1' }
    );
  });

  it('should find all timers', async () => {
    await controller.findAllTimers();
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.FIND_ALL },
      {}
    );
  });

  it('should create a timer', async () => {
    const createDto: CreateTimerDto = { taskId: '1' };
    await controller.createTimer(mockUser, createDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.CREATE },
      { ...createDto, createdBy: mockUser.profileId }
    );
  });

  it('should update a timer', async () => {
    const updateDto: UpdateTimerDto = { id: '1' };
    await controller.updateTimer(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId }
    );
  });

  it('should delete a timer', async () => {
    await controller.deleteTimer('1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.DELETE },
      { id: '1' }
    );
  });
});
