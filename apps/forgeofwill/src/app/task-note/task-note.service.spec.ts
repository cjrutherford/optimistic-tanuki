import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TaskNoteService } from './task-note.service';
import { ProfileService } from '../profile/profile.service';
import { TaskNote } from '@optimistic-tanuki/ui-models';

describe('TaskNoteService', () => {
  let service: TaskNoteService;
  let httpMock: HttpTestingController;
  let profileService: jest.Mocked<ProfileService>;

  const baseUrl = '/api/project-planning/task-notes';
  const mockProfile = { id: 'profile-123' } as any;

  beforeEach(() => {
    const profileServiceSpy = {
      getCurrentUserProfile: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TaskNoteService,
        { provide: ProfileService, useValue: profileServiceSpy },
      ],
    });

    service = TestBed.inject(TaskNoteService);
    httpMock = TestBed.inject(HttpTestingController);
    profileService = TestBed.inject(
      ProfileService
    ) as jest.Mocked<ProfileService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createTaskNote', () => {
    it('should create a task note', () => {
      const mockNoteData = {
        taskId: 'task-123',
        content: 'Test note',
      } as any;

      profileService.getCurrentUserProfile.mockReturnValue(mockProfile);

      service.createTaskNote(mockNoteData).subscribe();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.profileId).toBe('profile-123');
      req.flush({ id: 'note-1', ...mockNoteData, profileId: 'profile-123' });
    });

    it('should throw error if profile is not available', () => {
      profileService.getCurrentUserProfile.mockReturnValue(null);
      expect(() => service.createTaskNote({} as any)).toThrow('User profile is not available');
    });
  });

  describe('getTaskNotes', () => {
    it('should fetch all task notes', () => {
      service.getTaskNotes().subscribe();
      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('queryTaskNotes', () => {
    it('should query task notes', () => {
      const query = { taskId: 'task-123' };
      service.queryTaskNotes(query).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/query`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(query);
      req.flush([]);
    });
  });

  describe('getTaskNoteById', () => {
    it('should fetch a task note by id', () => {
      service.getTaskNoteById('note-1').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/note-1`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'note-1' });
    });
  });

  describe('updateTaskNote', () => {
    it('should update a task note', () => {
      const updateData = { id: 'note-1', content: 'Updated' } as any;
      profileService.getCurrentUserProfile.mockReturnValue(mockProfile);

      service.updateTaskNote(updateData).subscribe();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.updatedBy).toBe('profile-123');
      req.flush({ ...updateData });
    });

    it('should throw error if profile is not available', () => {
      profileService.getCurrentUserProfile.mockReturnValue(null);
      expect(() => service.updateTaskNote({} as any)).toThrow('User profile is not available');
    });
  });

  describe('deleteTaskNote', () => {
    it('should delete a task note', () => {
      service.deleteTaskNote('note-1').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/note-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getTaskNotesForTask', () => {
    it('should query notes for a specific task', () => {
      service.getTaskNotesForTask('task-123').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/query`);
      expect(req.request.body).toEqual({ taskId: 'task-123' });
      req.flush([]);
    });
  });
});