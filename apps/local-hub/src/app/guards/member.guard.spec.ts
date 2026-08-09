import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  Router,
} from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { MemberGuard } from './member.guard';
import { AuthStateService } from '../services/auth-state.service';
import { CommunityService } from '../services/community.service';

describe('MemberGuard', () => {
  const isAuthenticated$ = new BehaviorSubject(true);
  const authStateMock = {
    isAuthenticated$,
    waitForSessionRestore: jest.fn().mockResolvedValue(undefined),
  };
  const community = { id: 'city-1', slug: 'austin' };
  const communityServiceMock = {
    getCommunityBySlug: jest.fn().mockResolvedValue(community),
    isMember: jest.fn().mockResolvedValue(true),
  };

  let router: Router;

  beforeEach(() => {
    isAuthenticated$.next(true);
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        MemberGuard,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });
    router = TestBed.inject(Router);
  });

  function route(params: Record<string, string>): ActivatedRouteSnapshot {
    return {
      paramMap: convertToParamMap(params),
      url: [
        { path: 'classifieds', parameters: {} },
        { path: 'new', parameters: {} },
      ],
      parent: null,
    } as unknown as ActivatedRouteSnapshot;
  }

  it('loads membership using the city slug', async () => {
    await expect(
      TestBed.inject(MemberGuard).canActivate(route({ slug: 'austin' }))
    ).resolves.toBe(true);

    expect(communityServiceMock.getCommunityBySlug).toHaveBeenCalledWith(
      'austin'
    );
  });

  it('allows SSR after Express has authoritatively validated the session', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        MemberGuard,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });

    await expect(
      TestBed.inject(MemberGuard).canActivate(route({ slug: 'austin' }))
    ).resolves.toBe(true);

    expect(communityServiceMock.getCommunityBySlug).not.toHaveBeenCalled();
    expect(communityServiceMock.isMember).not.toHaveBeenCalled();
  });

  it('returns a city member redirect when membership fails', async () => {
    communityServiceMock.isMember.mockResolvedValueOnce(false);

    await expect(
      TestBed.inject(MemberGuard).canActivate(route({ slug: 'austin' }))
    ).resolves.toBe(false);

    expect(router.navigate).toHaveBeenCalledWith(['/city', 'austin']);
  });

  it('loads membership using the community slug', async () => {
    await expect(
      TestBed.inject(MemberGuard).canActivate(
        route({ communitySlug: 'garden-district' })
      )
    ).resolves.toBe(true);

    expect(communityServiceMock.getCommunityBySlug).toHaveBeenCalledWith(
      'garden-district'
    );
  });

  it('returns a community member redirect when membership fails', async () => {
    communityServiceMock.isMember.mockResolvedValueOnce(false);

    await expect(
      TestBed.inject(MemberGuard).canActivate(
        route({ communitySlug: 'garden-district' })
      )
    ).resolves.toBe(false);

    expect(router.navigate).toHaveBeenCalledWith(['/c', 'garden-district']);
  });

  it('fails safely when no locality route parameter is present', async () => {
    await expect(
      TestBed.inject(MemberGuard).canActivate(route({}))
    ).resolves.toBe(false);

    expect(communityServiceMock.getCommunityBySlug).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/communities']);
  });
});
