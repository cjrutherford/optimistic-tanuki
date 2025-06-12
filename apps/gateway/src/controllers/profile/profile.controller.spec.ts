import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ClientProxy } from '@nestjs/microservices';
import { CreateProfileDto, UpdateProfileDto, CreateProjectDto, UpdateProjectDto, CreateGoalDto, UpdateGoalDto, CreateTimelineDto, UpdateTimelineDto, TimelineEventType, ProfileDto } from '@optimistic-tanuki/models';
import { firstValueFrom, of } from 'rxjs';
import { GoalCommands, ProfileCommands, ProjectCommands, ServiceTokens, TimelineCommands } from '@optimistic-tanuki/constants';
import { UserDetails } from '../../decorators/user.decorator';

describe('ProfileController', () => {
  let controller: ProfileController;
  let clientProxy: ClientProxy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        },{
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        },{
          provide: ServiceTokens.ASSETS_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        }
      ]
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
    clientProxy = module.get<ClientProxy>(ServiceTokens.PROFILE_SERVICE);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a profile', async () => {
    const createProfileDto: CreateProfileDto = { 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      profilePic: 'https://www.google.com',
      coverPic: 'https://www.google.com',
      bio: 'I am a bio',
      location: 'USA',
      occupation: 'Software Engineer',
      interests: 'Coding',
      skills: 'Coding'
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const createResponse = await firstValueFrom(controller.createProfile(createProfileDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.Create }, createProfileDto);
    expect(createResponse).toEqual({});
  });

  it('should get a profile', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const getResponse = await firstValueFrom(controller.getProfile(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.Get }, id);
    expect(getResponse).toEqual({});
  });

  it('should get all profiles', async () => {
    const query = { userId: 'testUserId' } as Partial<ProfileDto>;
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of([]));

    const getAllResponse = await firstValueFrom(controller.getAllProfiles({ userId: 'user1234' } as UserDetails, query));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.GetAll }, { query, userId: 'user1234' });
    expect(getAllResponse).toEqual([]);
  });

  it('should update a profile', async () => {
    const id = '1';
    const updateProfileDto: UpdateProfileDto = { id, 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      profilePic: 'https://www.google.com',
      coverPic: 'https://www.google.com',
      bio: 'I am a bio',
      location: 'USA',
      occupation: 'Software Engineer',
      interests: 'Coding',
      skills: 'Coding'
    };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const updateResponse = await firstValueFrom(controller.updateProfile(id, updateProfileDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.Update }, { id, ...updateProfileDto });
    expect(updateResponse).toEqual({});
  });

  it('should delete a profile', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const deleteResponse = await firstValueFrom(controller.deleteProfile(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProfileCommands.Delete }, id);
    expect(deleteResponse).toEqual({});
  });

  it('should create a project', async () => {
    const createProjectDto: CreateProjectDto = { 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      timelineId: 'a;klsdjnfgn;lkajnerg;ljn',
      profileId: 'a;klsdjnfgn;lkajnerg;ljn'
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const createResponse = await firstValueFrom(controller.createProject(createProjectDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProjectCommands.Create}, createProjectDto);
    expect(createResponse).toEqual({});
  });

  it('should get a project', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const getResponse = await firstValueFrom(controller.getProject(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProjectCommands.Get }, id);
    expect(getResponse).toEqual({});
  });

  it('should update a project', async () => {
    const id = '1';
    const updateProjectDto: UpdateProjectDto = {
      id,
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      timelineId: 'a;klsdjnfgn;lkajnerg;ljn',
      profileId: 'a;klsdjnfgn;lkajnerg;ljn'
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const updateResponse = await firstValueFrom(controller.updateProject(id, updateProjectDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProjectCommands.Update }, { id, ...updateProjectDto });
    expect(updateResponse).toEqual({});
  });

  it('should delete a project', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const deleteResponse = await firstValueFrom(controller.deleteProject(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: ProjectCommands.Delete }, id);
    expect(deleteResponse).toEqual({});
  });

  it('should create a goal', async () => {
    const createGoalDto: CreateGoalDto = { 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      timelineId: 'a;klsdjnfgn;lkajnerg;ljn',
      projectId: 'a;klsdjnfgn;lkajnerg;ljn',
      profileId: 'a;klsdjnfgn;lkajnerg;ljn'
    };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const createResponse = await firstValueFrom(controller.createGoal(createGoalDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: GoalCommands.Create }, createGoalDto);
    expect(createResponse).toEqual({});
  });

  it('should get a goal', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const getResponse = await firstValueFrom(controller.getGoal(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: GoalCommands.Get }, id);
    expect(getResponse).toEqual({})
  });

  it('should update a goal', async () => {
    const id = '1';
    const updateGoalDto: UpdateGoalDto = { 
      id, 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const updateResponse = await firstValueFrom(controller.updateGoal(id, updateGoalDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: GoalCommands.Update }, { id, ...updateGoalDto });
    expect(updateResponse).toEqual({});
  });

  it('should delete a goal', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const deleteResponse = await firstValueFrom(controller.deleteGoal(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: GoalCommands.Delete }, id);
    expect(deleteResponse).toEqual({});
  });

  it('should create a timeline', async () => {
    const createTimelineDto: CreateTimelineDto = { 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      profileId: 'a;klsdjnfgn;lkajnerg;ljn',
      projectId: 'a;klsdjnfgn;lkajnerg;ljn',
      goalId: 'a;klsdjnfgn;lkajnerg;ljn',
      startDate: '2021-01-01',
      endDate: '2021-01-01',
      isCompleted: true,
      isPublished: true,
      isDeleted: false,
      type: TimelineEventType.Posted,
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const createResponse = await firstValueFrom(controller.createTimeline(createTimelineDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: TimelineCommands.Create }, createTimelineDto);
    expect(createResponse).toEqual({});
  });

  it('should get a timeline', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const getResponse = await firstValueFrom(controller.getTimeline(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: TimelineCommands.Get }, id);
    expect(getResponse).toEqual({});
  });

  it('should update a timeline', async () => {
    const id = '1';
    const updateTimelineDto: UpdateTimelineDto = {
      id, 
      name: 'Test',
      description: 'thomas morrow',
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const updateResponse = await firstValueFrom(controller.updateTimeline(id, updateTimelineDto));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: TimelineCommands.Update }, { id, ...updateTimelineDto });
    expect(updateResponse).toEqual({});
  });

  it('should delete a timeline', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    const deleteResponse = await firstValueFrom(controller.deleteTimeline(id));
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: TimelineCommands.Delete }, id);
    expect(deleteResponse).toEqual({});
  });
});