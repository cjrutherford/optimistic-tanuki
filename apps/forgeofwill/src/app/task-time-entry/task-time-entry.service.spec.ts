import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TaskTimeEntryService } from './task-time-entry.service';
import { ProfileService } from '../profile/profile.service';

describe('TaskTimeEntryService', () => {
  let service: TaskTimeEntryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TaskTimeEntryService,
        {
          provide: ProfileService,
          useValue: {
            getCurrentUserProfile: () => ({ id: 'test-profile-id' }),
          },
        },
      ],
    });
    service = TestBed.inject(TaskTimeEntryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
