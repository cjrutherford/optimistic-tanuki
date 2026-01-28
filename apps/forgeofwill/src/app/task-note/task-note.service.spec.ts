import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TaskNoteService } from './task-note.service';
import { ProfileService } from '../profile/profile.service';

describe('TaskNoteService', () => {
  let service: TaskNoteService;
  let httpMock: HttpTestingController;
  let profileService: jasmine.SpyObj<ProfileService>;

  beforeEach(() => {
    const profileServiceSpy = jasmine.createSpyObj('ProfileService', [
      'getCurrentUserProfile',
    ]);

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
    ) as jasmine.SpyObj<ProfileService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a task note', () => {
    const mockProfile = { id: 'user-123' } as any;
    const mockNote = {
      taskId: 'task-123',
      content: 'Test note',
    };

    profileService.getCurrentUserProfile.and.returnValue(mockProfile);

    service.createTaskNote(mockNote).subscribe();

    const req = httpMock.expectOne('/api/project-planning/task-notes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.profileId).toBe('user-123');
  });
});
