import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OffersPageComponent } from './offers-page.component';
import { MarketingStateService } from '../services/marketing-state.service';

describe('OffersPageComponent', () => {
  it('renders offer workspaces and a launch path into the new brief', async () => {
    await TestBed.configureTestingModule({
      imports: [OffersPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: MarketingStateService,
          useValue: {
            workspaces: signal([
              {
                id: 'offer-1',
                name: 'Forge of Will',
                createdAt: '2026-06-05T10:00:00.000Z',
                updatedAt: '2026-06-05T12:00:00.000Z',
                request: {},
                concepts: [{ id: 'concept-1' }, { id: 'concept-2' }],
                selectedConceptId: 'concept-1',
                versions: [{ id: 'version-1' }, { id: 'version-2' }],
              },
            ]),
            currentWorkspaceId: signal('offer-1'),
            workspaceStatus: signal({
              storageLabel: 'Browser storage only',
              currentWorkspaceName: 'Forge of Will',
              workspaceCount: 1,
              currentVersionCount: 2,
              conceptCount: 2,
              lastSavedAt: '2026-06-05T12:00:00.000Z',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OffersPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Offer workspaces');
    expect(fixture.nativeElement.textContent).toContain('Forge of Will');
    expect(fixture.nativeElement.textContent).toContain(
      'Open bundle workspace'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Start a new offer brief'
    );
  });
});
