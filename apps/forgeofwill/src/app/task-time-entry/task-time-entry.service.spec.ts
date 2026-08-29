import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TaskTimeEntryService } from './task-time-entry.service';
import { ProfileService } from '../profile/profile.service';
import { TaskTimeEntry } from '@optimistic-tanuki/ui-models';

describe('TaskTimeEntryService', () => {
  let service: TaskTimeEntryService;
  let httpMock: HttpTestingController;
  let profileService: any;

  const baseUrl = '/api/project-planning/task-time-entries';
  const mockProfile = { id: 'profile-123' };

  beforeEach(() => {
    profileService = {
      getCurrentUserProfile: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TaskTimeEntryService,
        { provide: ProfileService, useValue: profileService },
      ],
    });

    service = TestBed.inject(TaskTimeEntryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createTaskTimeEntry', () => {
    it('should create a task time entry', () => {
      const mockData = { taskId: 'task-123', startTime: new Date() } as any;
      profileService.getCurrentUserProfile.mockReturnValue(mockProfile);

      service.createTaskTimeEntry(mockData).subscribe();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.createdBy).toBe('profile-123');
      req.flush({ id: 'entry-1', ...mockData });
    });

    it('should throw error if profile is not available', () => {
      profileService.getCurrentUserProfile.mockReturnValue(null);
      expect(() => service.createTaskTimeEntry({} as any)).toThrow(
        'User profile is not available'
      );
    });
  });

  describe('getTaskTimeEntries', () => {
    it('should fetch all task time entries', () => {
      service.getTaskTimeEntries().subscribe();
      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('queryTaskTimeEntries', () => {
    it('should query task time entries', () => {
      const query = { taskId: 'task-123' };
      service.queryTaskTimeEntries(query).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/query`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(query);
      req.flush([]);
    });
  });

  describe('getTaskTimeEntryById', () => {
    it('should fetch a task time entry by id', () => {
      service.getTaskTimeEntryById('entry-1').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/entry-1`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'entry-1' });
    });
  });

  describe('updateTaskTimeEntry', () => {
    it('should update a task time entry', () => {
      const updateData = { id: 'entry-1', endTime: new Date() } as any;
      service.updateTaskTimeEntry(updateData).subscribe();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('PATCH');
      req.flush({ ...updateData });
    });
  });

  describe('deleteTaskTimeEntry', () => {
    it('should delete a task time entry', () => {
      service.deleteTaskTimeEntry('entry-1').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/entry-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getTaskTimeEntriesForTask', () => {
    it('should query entries for a specific task', () => {
      service.getTaskTimeEntriesForTask('task-123').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/query`);
      expect(req.request.body).toEqual({ taskId: 'task-123' });
      req.flush([]);
    });
  });

  describe('startTimer', () => {
    it('should start a timer for a task', () => {
      profileService.getCurrentUserProfile.mockReturnValue(mockProfile);
      service.startTimer('task-123').subscribe();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.taskId).toBe('task-123');
      expect(req.request.body.createdBy).toBe('profile-123');
      // No start time. The server reads its own clock, so a wrong clock here
      // cannot shift what gets recorded. The comment on startTimer always
      // claimed this while the code sent one anyway.
      expect(req.request.body.startTime).toBeUndefined();
      req.flush({ id: 'entry-1' });
    });

    it('should throw error if profile is not available', () => {
      profileService.getCurrentUserProfile.mockReturnValue(null);
      expect(() => service.startTimer('task-123')).toThrow(
        'User profile is not available'
      );
    });
  });

  describe('stopTimer', () => {
    /**
     * Stopping is its own route now, and carries nothing.
     *
     * It used to be an update sending an end time, which made the client the
     * authority on when work ended and how long it took. Since it sent no
     * duration and nothing derived one, every finished entry recorded zero
     * seconds. The server reads its own clock instead.
     */
    it('asks the server to stop the entry and tells it nothing else', () => {
      service.stopTimer('entry-1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/entry-1/stop`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush({ id: 'entry-1', elapsedSeconds: 42 });
    });
  });
});
