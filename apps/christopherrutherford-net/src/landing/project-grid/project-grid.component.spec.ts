import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProjectGridComponent } from './project-grid.component';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';

describe('ProjectGridComponent', () => {
  let component: ProjectGridComponent;
  let fixture: ComponentFixture<ProjectGridComponent>;
  const directoryServiceStub = {
    getResolvedApps: jest.fn().mockReturnValue(
      of([
        {
          appId: 'optimistic-tanuki',
          name: 'Optimistic Tanuki',
          portfolioSummary: 'A resume-building social platform project.',
          repositoryUrl:
            'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/client-interface',
          resolvedHref: 'https://social.example.com',
          isPublic: true,
        },
        {
          appId: 'opportunity-compass',
          name: 'Opportunity Compass',
          portfolioSummary:
            'An opportunity discovery tool based on interests, locality, and skills.',
          repositoryUrl:
            'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/leads-app',
          resolvedHref:
            'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/leads-app',
          isPublic: false,
        },
      ])
    ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectGridComponent],
      providers: [
        { provide: HaiAppDirectoryService, useValue: directoryServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders portfolio projects from the HAI app registry', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Optimistic Tanuki');
    expect(text).toContain('Opportunity Compass');
    expect(text).toContain('resume-building social platform project');
    expect(text).toContain('opportunity discovery tool');
  });

  it('uses public CTAs for public projects and repository CTAs for private projects', () => {
    const projects = component.portfolioProjects([
      {
        appId: 'optimistic-tanuki',
        name: 'Optimistic Tanuki',
        portfolioSummary: 'Public project',
        repositoryUrl:
          'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/client-interface',
        resolvedHref: 'https://social.example.com',
        isPublic: true,
      } as any,
      {
        appId: 'opportunity-compass',
        name: 'Opportunity Compass',
        portfolioSummary: 'Private project',
        repositoryUrl:
          'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/leads-app',
        resolvedHref:
          'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/leads-app',
        isPublic: false,
      } as any,
    ]);

    expect(projects[0].readMoreText).toBe('Open Project');
    expect(projects[0].secondaryButtonText).toBe('View Repository');
    expect(projects[1].readMoreText).toBe('View Repository');
    expect(projects[1].secondaryButtonText).toBe('');
  });
});
