import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MilestonesPageComponent } from './milestones-page.component';
import { ProjectNexusApiService } from '../../services/project-nexus-api.service';
import { NexusFieldSyncService } from '../../services/nexus-field-sync.service';

describe('MilestonesPageComponent', () => {
  let fixture: ComponentFixture<MilestonesPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MilestonesPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'project-1' } },
          },
        },
        {
          provide: ProjectNexusApiService,
          useValue: {
            getMilestones: jest.fn().mockReturnValue(
              of([
                {
                  id: 'm-1',
                  projectId: 'project-1',
                  phase: 'Foundation',
                  status: 'in_progress',
                  plannedStart: '2026-01-05T08:00:00.000Z',
                  plannedEnd: '2020-02-05T17:00:00.000Z',
                  progressPercent: 40,
                  predecessorIds: [],
                  delayDays: 5,
                  delayed: true,
                },
              ])
            ),
          },
        },
        {
          provide: NexusFieldSyncService,
          useValue: {
            cachedMilestones: jest.fn().mockResolvedValue(null),
            cacheSnapshot: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MilestonesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the Gantt with delay alerts and no fabricated rows', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Foundation');
    expect(text).toContain('Delayed 5d');
    expect(
      fixture.nativeElement.querySelector('[data-delayed="true"]')
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.gantt-bar.delayed')
    ).toBeTruthy();
  });
});
