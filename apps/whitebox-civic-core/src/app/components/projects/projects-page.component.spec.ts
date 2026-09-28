import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProjectsPageComponent } from './projects-page.component';
import { CivicApiService } from '../../services/civic-api.service';
import { createProjectsFeatureCollection } from './projects-page.component';

describe('ProjectsPageComponent', () => {
  let component: ProjectsPageComponent;
  let fixture: ComponentFixture<ProjectsPageComponent>;
  let apiMock: { getTipProjects: jest.Mock; getTipProject: jest.Mock };

  beforeEach(async () => {
    apiMock = {
      getTipProjects: jest.fn().mockReturnValue(
        of([
          {
            id: 'tip-1',
            name: 'Islands Expressway resurfacing',
            description: 'Mill and resurface 4.2 miles.',
            geometry: { type: 'Point', coordinates: [-81.05, 32.02] },
            fundingAllocatedCents: 4000000000,
            fundingSpentCents: 1000000000,
            status: 'funded',
            milestone: 'Design complete',
          },
        ])
      ),
      getTipProject: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectsPageComponent],
      providers: [
        provideRouter([]),
        { provide: CivicApiService, useValue: apiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens project detail as a dialog with keyboard focus return', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Islands Expressway resurfacing');
    expect(text).not.toContain('$40,000,000');

    const trigger = fixture.nativeElement.querySelector(
      '.project-select'
    ) as HTMLButtonElement;
    const dialog = fixture.nativeElement.querySelector(
      'dialog'
    ) as HTMLDialogElement;
    const close = fixture.nativeElement.querySelector(
      '.dialog-close'
    ) as HTMLButtonElement;
    dialog.showModal = jest.fn(() => dialog.setAttribute('open', ''));
    dialog.close = jest.fn(() => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    });
    trigger.focus();
    component.selectProject(component.projects[0], trigger);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Current milestone: Design complete'
    );
    expect(fixture.nativeElement.textContent).toContain('25%');
    expect(fixture.nativeElement.textContent).toContain('$40,000,000');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.showModal).toHaveBeenCalled();
    expect(close).toBe(document.activeElement);

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dialog.close).toHaveBeenCalled();
    expect(trigger).toBe(document.activeElement);
  });

  it('preserves line and polygon GeoJSON for the map layer', () => {
    const projects = [
      {
        ...component.projects[0],
        id: 'road-line',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-81.1, 32.0],
            [-81.0, 32.1],
          ],
        },
      },
    ];

    expect(createProjectsFeatureCollection(projects)).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'road-line',
          properties: {
            id: 'road-line',
            name: 'Islands Expressway resurfacing',
          },
          geometry: projects[0].geometry,
        },
      ],
    });
  });

  it('flattens valid GeometryCollections into renderable GeoJSON features', () => {
    const project = {
      ...component.projects[0],
      id: 'mixed-project',
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [-81.1, 32.0] },
          {
            type: 'LineString',
            coordinates: [
              [-81.1, 32.0],
              [-81.0, 32.1],
            ],
          },
        ],
      },
    };

    const result = createProjectsFeatureCollection([project]);

    expect(result.features).toHaveLength(2);
    expect(result.features.map((feature) => feature.geometry.type)).toEqual([
      'Point',
      'LineString',
    ]);
    expect(
      result.features.every((feature) => feature.id.startsWith('mixed-project'))
    ).toBe(true);
  });

  it('shows an unavailable program instead of fabricated projects', () => {
    apiMock.getTipProjects.mockReturnValue(
      throwError(() => new Error('civic down'))
    );
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.projects).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain(
      'Transportation projects are unavailable'
    );
  });
});
