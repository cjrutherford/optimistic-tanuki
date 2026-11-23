import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, of } from 'rxjs';
import { CommunityService } from '../../services/community.service';
import { TownContextService } from '../../services/town-context.service';
import { buildEntityActions } from './community-ops-data.service';
import { CommunityOpsEntity } from './community-ops.model';
import { TownCommunitiesComponent } from './town-communities.component';
import { TownNotFoundComponent } from './town-not-found.component';
import { TownOverviewComponent } from './town-overview.component';
import { TownsPickerComponent } from './towns-picker.component';

interface CommunityServiceStub {
  getCommunities: jest.Mock;
  getCities: jest.Mock;
  getCommunityMembers: jest.Mock;
  getCommunityManager: jest.Mock;
}

const member = (id: string, status: string, joinedAt: string) => ({
  id,
  userId: `u-${id}`,
  profileId: `p-${id}`,
  role: 'member',
  status,
  joinedAt,
});

describe('town pages', () => {
  let service: CommunityServiceStub;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    localStorage.clear();
    params = new BehaviorSubject(convertToParamMap({ townId: 'city-1' }));
    service = {
      getCommunities: jest.fn(() =>
        of([
          {
            id: 'community-1',
            name: 'Makers Guild',
            localityType: 'town',
            description: 'Local makers',
            createdAt: '2026-07-01T00:00:00.000Z',
          },
          {
            id: 'community-2',
            name: 'Writers Circle',
            description: 'Weekly workshop',
            createdAt: '2026-06-20T00:00:00.000Z',
          },
        ])
      ),
      getCities: jest.fn(() =>
        of([
          {
            id: 'city-1',
            name: 'Raleigh',
            localityType: 'city',
            city: 'Raleigh',
            adminArea: 'NC',
            population: 480000,
            createdAt: '2026-05-12T00:00:00.000Z',
          },
        ])
      ),
      getCommunityMembers: jest.fn((id: string) =>
        of(
          id === 'community-1'
            ? [
                member('m1', 'approved', '2026-07-02T00:00:00.000Z'),
                member('m2', 'approved', '2026-07-03T00:00:00.000Z'),
              ]
            : [member('m3', 'pending', '2026-06-25T00:00:00.000Z')]
        )
      ),
      getCommunityManager: jest.fn((id: string) =>
        of(id === 'community-1' ? { userId: 'u', profileId: 'p-m1' } : null)
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CommunityService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: params,
            snapshot: { paramMap: params.value },
          },
        },
      ],
    });
  });

  describe('TownsPickerComponent', () => {
    it('lists the towns and opens one, setting the town context', () => {
      const fixture = TestBed.createComponent(TownsPickerComponent);
      fixture.detectChanges();
      const navigate = jest
        .spyOn(TestBed.inject(Router), 'navigate')
        .mockResolvedValue(true);
      const buttons = fixture.debugElement.queryAll(By.css('button.town'));
      expect(buttons.map((b) => b.nativeElement.textContent)).toEqual([
        expect.stringContaining('Makers Guild'),
        expect.stringContaining('Raleigh'),
      ]);

      buttons[1].nativeElement.click();

      expect(TestBed.inject(TownContextService).selected()?.id).toBe('city-1');
      expect(navigate).toHaveBeenCalledWith([
        '/dashboard/towns',
        'city-1',
        'overview',
      ]);
    });

    it('filters by search text', () => {
      const fixture = TestBed.createComponent(TownsPickerComponent);
      fixture.detectChanges();
      fixture.componentInstance.query.set('ral');
      fixture.detectChanges();
      expect(fixture.debugElement.queryAll(By.css('button.town')).length).toBe(
        1
      );
    });
  });

  describe('TownOverviewComponent', () => {
    it('shows the town entity with its town-scoped actions', () => {
      const fixture = TestBed.createComponent(TownOverviewComponent);
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Raleigh');
      const hrefs = fixture.debugElement
        .queryAll(By.css('.action-link'))
        .map((a) => a.nativeElement.getAttribute('href'));
      expect(hrefs).toContain('/dashboard/towns/city-1/boundary-review');
    });

    it('persists operator notes per entity', () => {
      const fixture = TestBed.createComponent(TownOverviewComponent);
      fixture.detectChanges();
      const detail = fixture.debugElement.query(
        By.css('app-ops-entity-detail')
      ).componentInstance;
      detail.noteDraft = 'Boundary needs a second look.';
      detail.saveNote();
      expect(detail.activeNotes).toEqual([
        expect.objectContaining({ body: 'Boundary needs a second look.' }),
      ]);
      expect(
        localStorage.getItem('owner-console.community-ops.journal')
      ).toContain('Boundary needs a second look.');
    });
  });

  describe('TownCommunitiesComponent', () => {
    const create = () => {
      const fixture = TestBed.createComponent(TownCommunitiesComponent);
      fixture.detectChanges();
      return fixture;
    };

    it('loads metrics and browses communities and members, not cities', () => {
      const component = create().componentInstance;
      expect(component.summaryMetrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Communities', value: '2' }),
          expect.objectContaining({ label: 'Member records', value: '3' }),
        ])
      );
      expect(component.entities.some((e) => e.entityType === 'city')).toBe(
        false
      );
      expect(component.selectedEntity?.entityType).toBe('community');
    });

    it('filters to members', () => {
      const component = create().componentInstance;
      component.entityTypeFilter = 'member';
      component.applyFilters();
      expect(component.filteredEntities.map((e) => e.id)).toEqual([
        'community-2:m3',
        'community-1:m2',
        'community-1:m1',
      ]);
    });

    it('pivots from a community to its members', () => {
      const component = create().componentInstance;
      component.selectEntity(
        component.entities.find(
          (e) => e.id === 'community-1'
        ) as CommunityOpsEntity
      );
      expect(component.relatedEntities.map((e) => e.id)).toEqual([
        'community-1:m2',
        'community-1:m1',
      ]);
    });

    it('surfaces journal pressure in the browser once a case exists', () => {
      const fixture = create();
      const detail = fixture.debugElement.query(
        By.css('app-ops-entity-detail')
      ).componentInstance;
      detail.caseDraft = {
        title: 'Vacancy',
        summary: 'No manager',
        owner: 'Sam',
      };
      detail.createCase();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        '1 open case'
      );
    });
  });

  describe('buildEntityActions', () => {
    const city: CommunityOpsEntity = {
      id: 'city-1',
      entityType: 'city',
      title: 'Raleigh',
      subtitle: '',
      detail: '',
      health: 'healthy',
      timestamp: '2026-05-12',
      route: '/dashboard/cities/city-1',
    };

    it('routes locality pages under the town', () => {
      expect(buildEntityActions(city)).toContainEqual({
        label: 'Review Duplicates',
        route: ['/dashboard/towns', 'city-1', 'directory-duplicates'],
      });
    });

    it('gives a town-typed community the same town pages', () => {
      expect(
        buildEntityActions({
          ...city,
          id: 'community-1',
          entityType: 'community',
          localityType: 'town',
        })
      ).toContainEqual({
        label: 'Review Boundary',
        route: ['/dashboard/towns', 'community-1', 'boundary-review'],
      });
    });
  });

  describe('TownNotFoundComponent', () => {
    it('names the town and links back to the picker', () => {
      const fixture = TestBed.createComponent(TownNotFoundComponent);
      fixture.componentRef.setInput('townId', 'ghost');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Town not found');
      expect(el.textContent).toContain('ghost');
      expect(el.querySelector('a')?.getAttribute('href')).toBe(
        '/dashboard/towns'
      );
    });
  });
});
