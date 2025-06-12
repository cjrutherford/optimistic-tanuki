import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { ServiceTokens, TasksCommands } from '@optimistic-tanuki/constants';
import { CreateTaskDto } from '@optimistic-tanuki/models';

describe('TasksController', () => {
  let controller: TasksController;
  let mockTasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: ServiceTokens.TASKS_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation((pattern, data) => {
              // Mock implementation of the send method
              return Promise.resolve({ success: true, pattern, data });
            }),
          },
        },
      ],
    }).compile();
    mockTasksService = module.get(ServiceTokens.TASKS_SERVICE);
    controller = module.get<TasksController>(TasksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a task', async () => {
    const createTaskDto: CreateTaskDto = {
        title: 'Test Task',
        description: 'This is a test task.',
    }
    const createResponse = await controller.create(createTaskDto);
    expect(createResponse).toEqual({
      success: true,
      pattern: { cmd: TasksCommands.CREATE },
      data: createTaskDto,
    });

    expect(mockTasksService.send).toHaveBeenCalledWith(
      { cmd: TasksCommands.CREATE },
      createTaskDto
    );
  });

  it('should get a task', async () => {
    const taskId = '123';
    const getResponse = await controller.findOne(taskId);
    expect(getResponse).toEqual({
      success: true,
      pattern: { cmd: TasksCommands.FIND_ONE },
      data: taskId,
    });

    expect(mockTasksService.send).toHaveBeenCalledWith(
      { cmd: TasksCommands.FIND_ONE },
      taskId
    );
  });

  it('should update a task', async () => {
    const taskId = '123';
    const updateData = { title: 'Updated Task', description: 'Updated description' };
    const updateResponse = await controller.update(taskId, updateData);
    expect(updateResponse).toEqual({
      success: true,
      pattern: { cmd: TasksCommands.UPDATE },
      data: { id: taskId, data: updateData },
    });

    expect(mockTasksService.send).toHaveBeenCalledWith(
      { cmd: TasksCommands.UPDATE },
      { id: taskId, data: updateData }
    );
  });

  it('should delete a task', async () => {
    const taskId = '123';
    const deleteResponse = await controller.remove(taskId);
    expect(deleteResponse).toEqual({
      success: true,
      pattern: { cmd: TasksCommands.DELETE },
      data: taskId,
    });

    expect(mockTasksService.send).toHaveBeenCalledWith(
      { cmd: TasksCommands.DELETE },
      taskId
    );
  });
});