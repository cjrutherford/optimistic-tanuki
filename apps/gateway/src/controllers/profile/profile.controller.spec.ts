import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ClientProxy } from '@nestjs/microservices';
import { CreateProfileDto, UpdateProfileDto, CreateProjectDto, UpdateProjectDto, CreateGoalDto, UpdateGoalDto, CreateTimelineDto, UpdateTimelineDto, TimelineEventType } from '@optimistic-tanuki/models';
import { of } from 'rxjs';

describe('ProfileController', () => {
  let controller: ProfileController;
  let clientProxy: ClientProxy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: 'PROFILE_SERVICE',
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        },{
          provide: 'AUTHENTICATION_SERVICE',
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          }
        }
      ]
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
    clientProxy = module.get<ClientProxy>('PROFILE_SERVICE');
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a profile', () => {
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

    controller.createProfile(createProfileDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Create:Profile' }, createProfileDto);
  });

  it('should get a profile', () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.getProfile(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Get:Profile' }, id);
  });

  it('should update a profile', () => {
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

    controller.updateProfile(id, updateProfileDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Update:Profile' }, { id, ...updateProfileDto });
  });

  it('should delete a profile', () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.deleteProfile(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Delete:Profile' }, id);
  });

  it('should create a project', () => {
    const createProjectDto: CreateProjectDto = { 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      timelineId: 'a;klsdjnfgn;lkajnerg;ljn',
      profileId: 'a;klsdjnfgn;lkajnerg;ljn'
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.createProject(createProjectDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Create:Project' }, createProjectDto);
  });

  it('should get a project', () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.getProject(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Get:Project' }, id);
  });

  it('should update a project', () => {
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

    controller.updateProject(id, updateProjectDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Update:Project' }, { id, ...updateProjectDto });
  });

  it('should delete a project', () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.deleteProject(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Delete:Project' }, id);
  });

  it('should create a goal', () => {
    const createGoalDto: CreateGoalDto = { 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
      timelineId: 'a;klsdjnfgn;lkajnerg;ljn',
      projectId: 'a;klsdjnfgn;lkajnerg;ljn',
      profileId: 'a;klsdjnfgn;lkajnerg;ljn'
    };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.createGoal(createGoalDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Create:Goal' }, createGoalDto);
  });

  it('should get a goal', () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.getGoal(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Get:Goal' }, id);
  });

  it('should update a goal', () => {
    const id = '1';
    const updateGoalDto: UpdateGoalDto = { 
      id, 
      name: 'Test',
      description: 'thomas morrow',
      userId: 'a;klsdjnfgn;lkajnerg;ljn',
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.updateGoal(id, updateGoalDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Update:Goal' }, { id, ...updateGoalDto });
  });

  it('should delete a goal', () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.deleteGoal(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Delete:Goal' }, id);
  });

  it('should create a timeline', () => {
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

    controller.createTimeline(createTimelineDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Create:Timeline' }, createTimelineDto);
  });

  it('should get a timeline', () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.getTimeline(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'getTimeline' }, id);
  });

  it('should update a timeline', () => {
    const id = '1';
    const updateTimelineDto: UpdateTimelineDto = {
      id, 
      name: 'Test',
      description: 'thomas morrow',
     };
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.updateTimeline(id, updateTimelineDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Update:Timeline' }, { id, ...updateTimelineDto });
  });

  it('should delete a timeline', () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockImplementation(() => of({}));

    controller.deleteTimeline(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: 'Delete:Timeline' }, id);
  });
});