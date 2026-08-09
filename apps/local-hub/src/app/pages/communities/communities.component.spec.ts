import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommunitiesComponent } from './communities.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

const communityServiceMock = {
  getCommunities: jest.fn().mockResolvedValue([]),
};

describe('CommunitiesComponent', () => {
  let component: CommunitiesComponent;
  let fixture: ComponentFixture<CommunitiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommunitiesComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not show a stale error when a later load fails after data loaded', async () => {
    const community = {
      id: 'community-1',
      name: 'Starland Makers',
      slug: 'starland-makers',
      description: 'A local makers community',
      localityType: 'neighborhood',
      countryCode: 'US',
      adminArea: 'GA',
      city: 'Savannah',
      memberCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    } satisfies LocalCommunity;

    communityServiceMock.getCommunities
      .mockResolvedValueOnce([community])
      .mockRejectedValueOnce(new Error('temporary network failure'));

    await component.ngOnInit();
    await component.ngOnInit();

    expect(component.communities()).toEqual([community]);
    expect(component.error()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  it('shows an error when the initial load fails without usable data', async () => {
    const freshFixture = TestBed.createComponent(CommunitiesComponent);
    const freshComponent = freshFixture.componentInstance;
    communityServiceMock.getCommunities.mockRejectedValueOnce(
      new Error('initial network failure')
    );

    await freshComponent.ngOnInit();

    expect(freshComponent.communities()).toEqual([]);
    expect(freshComponent.error()).toBe(
      'Unable to load communities. Please try again later.'
    );
    expect(freshComponent.loading()).toBe(false);
    freshFixture.destroy();
  });
});
