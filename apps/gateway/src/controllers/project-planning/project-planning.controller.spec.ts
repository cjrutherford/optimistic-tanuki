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

  // The gateway always forwards the authenticated profile id so the
  // project-planning service can enforce ownership. Assert it is present.
  const requestingUserId = mockUser.profileId;

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
    await controller.findProjectById(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.FIND_ONE },
      { id: '1', requestingUserId }
    );
  });

  it('should find all projects scoped to the caller', async () => {
    await controller.findAllProjects(mockUser);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.FIND_ALL },
      { requestingUserId }
    );
  });

  it('should query projects scoped to the caller', async () => {
    const query: QueryProjectDto = { name: 'Test' };
    await controller.queryProjects(mockUser, query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.FIND_ALL },
      { ...query, requestingUserId }
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
      { ...updateDto, updatedBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should delete a project', async () => {
    await controller.deleteProject(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectCommands.DELETE },
      { id: '1', requestingUserId }
    );
  });

  it('should find a change by id', async () => {
    await controller.findChangeById(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.FIND_ONE },
      { id: '1', requestingUserId }
    );
  });

  it('should find all changes scoped to the caller', async () => {
    await controller.findAllChanges(mockUser);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.FIND_ALL },
      { requestingUserId }
    );
  });

  it('should query changes scoped to the caller', async () => {
    const query: QueryChangeDto = { changeDescription: 'Test' };
    await controller.queryChanges(mockUser, query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.FIND_ALL },
      { ...query, requestingUserId }
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
      { ...createDto, createdBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should update a change', async () => {
    const updateDto: UpdateChangeDto = { id: '1' };
    await controller.updateChange(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should delete a change', async () => {
    await controller.deleteChange(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ChangeCommands.REMOVE },
      { id: '1', requestingUserId }
    );
  });

  it('should find a journal by id', async () => {
    await controller.findJournalById(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.FIND_ONE },
      { id: '1', requestingUserId }
    );
  });

  it('should find all journals scoped to the caller', async () => {
    await controller.findAllJournals(mockUser);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.FIND_ALL },
      { requestingUserId }
    );
  });

  it('should query journals scoped to the caller', async () => {
    const query: QueryProjectJournalDto = { content: 'Test' };
    await controller.queryJournals(mockUser, query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.FIND_ALL },
      { ...query, requestingUserId }
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
      { ...createDto, createdBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should update a journal', async () => {
    const updateDto: UpdateProjectJournalDto = { id: '1' };
    await controller.updateJournal(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should delete a journal', async () => {
    await controller.deleteJournal(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: ProjectJournalCommands.REMOVE },
      { id: '1', requestingUserId }
    );
  });

  it('should find a risk by id', async () => {
    await controller.findRiskById(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.FIND_ONE },
      { id: '1', requestingUserId }
    );
  });

  it('should find all risks scoped to the caller', async () => {
    await controller.findAllRisks(mockUser);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.FIND_ALL },
      { requestingUserId }
    );
  });

  it('should query risks scoped to the caller', async () => {
    const query: QueryRiskDto = { name: 'Test' };
    await controller.queryRisks(mockUser, query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.FIND_ALL },
      { ...query, requestingUserId }
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
      { ...createDto, createdBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should update a risk', async () => {
    const updateDto: UpdateRiskDto = { id: '1', name: 'Test' };
    await controller.updateRisk(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should delete a risk', async () => {
    await controller.deleteRisk(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: RiskCommands.DELETE },
      { id: '1', requestingUserId }
    );
  });

  it('should find a task by id', async () => {
    await controller.findTaskById(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.FIND_ONE },
      { id: '1', requestingUserId }
    );
  });

  it('should find all tasks scoped to the caller', async () => {
    await controller.findAllTasks(mockUser);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.FIND_ALL },
      { requestingUserId }
    );
  });

  it('should query tasks scoped to the caller', async () => {
    const query: QueryTaskDto = { title: 'Test' };
    await controller.queryTasks(mockUser, query);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.FIND_ALL },
      { ...query, requestingUserId }
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
      { ...createDto, createdBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should update a task', async () => {
    const updateDto: UpdateTaskDto = { id: '1', title: 'Test' };
    await controller.updateTask(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should delete a task', async () => {
    await controller.deleteTask(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TaskCommands.DELETE },
      { id: '1', requestingUserId }
    );
  });

  it('should find a timer by id', async () => {
    await controller.findTimerById(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.FIND_ONE },
      { id: '1', requestingUserId }
    );
  });

  it('should find all timers scoped to the caller', async () => {
    await controller.findAllTimers(mockUser);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.FIND_ALL },
      { requestingUserId }
    );
  });

  it('should create a timer', async () => {
    const createDto: CreateTimerDto = { taskId: '1' };
    await controller.createTimer(mockUser, createDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.CREATE },
      { ...createDto, createdBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should update a timer', async () => {
    const updateDto: UpdateTimerDto = { id: '1' };
    await controller.updateTimer(mockUser, updateDto);
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.UPDATE },
      { ...updateDto, updatedBy: mockUser.profileId, requestingUserId }
    );
  });

  it('should delete a timer', async () => {
    await controller.deleteTimer(mockUser, '1');
    expect(projectPlanningService.send).toHaveBeenCalledWith(
      { cmd: TimerCommands.DELETE },
      { id: '1', requestingUserId }
    );
  });
});
