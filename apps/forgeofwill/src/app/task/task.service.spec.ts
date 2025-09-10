import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TaskService } from './task.service';
import { ProfileService } from '../profile/profile.service';
import { CreateTask, Task } from '@optimistic-tanuki/ui-models';
import { of, throwError } from 'rxjs';

describe('TaskService', () => {
  let service: TaskService;
  let httpMock: HttpTestingController;
  let profileServiceMock: any;

  const mockProfile = { id: 'user1', profileName: 'Test User' };
  const mockTask: Task = {
    id: '1',
    title: 'Test Task',
    description: 'Description',
    projectId: 'proj1',
    status: 'TODO',
    priority: 'MEDIUM',
    createdBy: 'user1',
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: 'user1',
    dueDate: new Date(),
  };

  beforeEach(() => {
    profileServiceMock = {
      getCurrentUserProfile: jest.fn().mockReturnValue(mockProfile),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TaskService,
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    });

    service = TestBed.inject(TaskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensure that no outstanding requests are pending
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createTask', () => {
    it('should create a task successfully', () => {
      const createTaskDto: CreateTask = {
        title: 'New Task',
        description: 'New Description',
        projectId: 'proj1',
        status: 'TODO',
        priority: 'HIGH',
        createdBy: 'user1',
      };

      service.createTask(createTaskDto).subscribe((task) => {
        expect(task).toEqual(mockTask);
      });

      const req = httpMock.expectOne('/api/project-planning/tasks');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.createdBy).toBe(mockProfile.id);
      req.flush(mockTask);
    });

    it('should throw an error if user profile is not available', () => {
      profileServiceMock.getCurrentUserProfile.mockReturnValue(null);
      expect(() => {
        service.createTask({} as CreateTask);
      }).toThrow('User profile is not available');
    });

    it('should handle API errors when creating a task', () => {
      const errorMessage = 'Test Error';
      const errorResponse = { status: 500, statusText: 'Server Error' };

      service.createTask({} as CreateTask).subscribe({
        next: () => fail('should have failed with the 500 error'),
        error: (error) => {
          expect(error.status).toBe(500);
          expect(error.statusText).toBe('Server Error');
        },
      });

      const req = httpMock.expectOne('/api/project-planning/tasks');
      expect(req.request.method).toBe('POST');
      req.flush(errorMessage, errorResponse);
    });
  });

  describe('getTasks', () => {
    it('should retrieve tasks successfully', () => {
      const tasks: Task[] = [mockTask];

      service.getTasks().subscribe((data) => {
        expect(data).toEqual(tasks);
      });

      const req = httpMock.expectOne('/api/project-planning/tasks');
      expect(req.request.method).toBe('GET');
      req.flush(tasks);
    });

    it('should handle API errors when retrieving tasks', () => {
      const errorMessage = 'Test Error';
      const errorResponse = { status: 500, statusText: 'Server Error' };

      service.getTasks().subscribe({
        next: () => fail('should have failed with the 500 error'),
        error: (error) => {
          expect(error.status).toBe(500);
          expect(error.statusText).toBe('Server Error');
        },
      });

      const req = httpMock.expectOne('/api/project-planning/tasks');
      expect(req.request.method).toBe('GET');
      req.flush(errorMessage, errorResponse);
    });
  });

  describe('queryTasks', () => {
    it('should query tasks successfully', () => {
      const tasks: Task[] = [mockTask];
      const query = { projectId: 'proj1' };

      service.queryTasks(query).subscribe((data) => {
        expect(data).toEqual(tasks);
      });

      const req = httpMock.expectOne('/api/project-planning/tasks/query');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(query);
      req.flush(tasks);
    });

    it('should handle API errors when querying tasks', () => {
      const errorMessage = 'Test Error';
      const errorResponse = { status: 500, statusText: 'Server Error' };

      service.queryTasks({} as any).subscribe({
        next: () => fail('should have failed with the 500 error'),
        error: (error) => {
          expect(error.status).toBe(500);
          expect(error.statusText).toBe('Server Error');
        },
      });

      const req = httpMock.expectOne('/api/project-planning/tasks/query');
      expect(req.request.method).toBe('POST');
      req.flush(errorMessage, errorResponse);
    });
  });

  describe('getTaskById', () => {
    it('should retrieve a task by ID successfully', () => {
      service.getTaskById('1').subscribe((task) => {
        expect(task).toEqual(mockTask);
      });

      const req = httpMock.expectOne('/api/project-planning/tasks/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockTask);
    });

    it('should handle API errors when retrieving a task by ID', () => {
      const errorMessage = 'Test Error';
      const errorResponse = { status: 500, statusText: 'Server Error' };

      service.getTaskById('1').subscribe({
        next: () => fail('should have failed with the 500 error'),
        error: (error) => {
          expect(error.status).toBe(500);
          expect(error.statusText).toBe('Server Error');
        },
      });

      const req = httpMock.expectOne('/api/project-planning/tasks/1');
      expect(req.request.method).toBe('GET');
      req.flush(errorMessage, errorResponse);
    });
  });

  describe('updateTask', () => {
    it('should update a task successfully', () => {
      const updatedTask: Task = { ...mockTask, title: 'Updated Task' };

      service.updateTask(updatedTask).subscribe((task) => {
        expect(task).toEqual(updatedTask);
      });

      const req = httpMock.expectOne('/api/project-planning/tasks');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updatedTask);
      req.flush(updatedTask);
    });

    it('should handle API errors when updating a task', () => {
      const errorMessage = 'Test Error';
      const errorResponse = { status: 500, statusText: 'Server Error' };

      service.updateTask({} as Task).subscribe({
        next: () => fail('should have failed with the 500 error'),
        error: (error) => {
          expect(error.status).toBe(500);
          expect(error.statusText).toBe('Server Error');
        },
      });

      const req = httpMock.expectOne('/api/project-planning/tasks');
      expect(req.request.method).toBe('PATCH');
      req.flush(errorMessage, errorResponse);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task successfully', () => {
      service.deleteTask('1').subscribe((response) => {
        expect(response).toBeUndefined();
      });

      const req = httpMock.expectOne('/api/project-planning/tasks/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null); // DELETE requests often return null or empty object
    });

    it('should handle API errors when deleting a task', () => {
      const errorMessage = 'Test Error';
      const errorResponse = { status: 500, statusText: 'Server Error' };

      service.deleteTask('1').subscribe({
        next: () => fail('should have failed with the 500 error'),
        error: (error) => {
          expect(error.status).toBe(500);
          expect(error.statusText).toBe('Server Error');
        },
      });

      const req = httpMock.expectOne('/api/project-planning/tasks/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(errorMessage, errorResponse);
    });
  });
});
