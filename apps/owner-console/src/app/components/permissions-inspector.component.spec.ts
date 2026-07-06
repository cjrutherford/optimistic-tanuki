import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PermissionsInspectorComponent } from './permissions-inspector.component';
import { UsersService } from '../services/users.service';
import { RolesService } from '../services/roles.service';
import { PermissionsService } from '../services/permissions.service';

describe('PermissionsInspectorComponent', () => {
  const getProfiles = jest.fn();
  const getUserRoles = jest.fn();
  const getPermissions = jest.fn();
  const getRoles = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    getProfiles.mockReturnValue(
      of([
        {
          id: 'profile-1',
          userId: 'user-1',
          profileName: 'Operator One',
          profilePic: '',
          coverPic: '',
          bio: '',
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          created_at: new Date('2026-07-01T10:00:00.000Z'),
          appScope: 'global',
        },
        {
          id: 'profile-2',
          userId: 'user-2',
          profileName: 'Operator Two',
          profilePic: '',
          coverPic: '',
          bio: '',
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          created_at: new Date('2026-07-02T10:00:00.000Z'),
          appScope: 'global',
        },
      ])
    );
    getUserRoles.mockImplementation((profileId: string) =>
      of(
        profileId === 'profile-1'
          ? [
              {
                id: 'assignment-1',
                roleId: 'role-1',
                role: {
                  id: 'role-1',
                  name: 'owner_console_owner',
                  permissions: [
                    { id: 'perm-1', name: 'users.update' },
                    { id: 'perm-2', name: 'roles.update' },
                  ],
                },
              },
            ]
          : [
              {
                id: 'assignment-2',
                roleId: 'role-2',
                role: {
                  id: 'role-2',
                  name: 'community_operator',
                  permissions: [{ id: 'perm-3', name: 'community.manage' }],
                },
              },
            ]
      )
    );
    getPermissions.mockReturnValue(of([]));
    getRoles.mockReturnValue(of([]));
  });

  async function configureWithQueryParams(params: Record<string, string>) {
    await TestBed.configureTestingModule({
      imports: [PermissionsInspectorComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap(params)),
            snapshot: {
              queryParamMap: convertToParamMap(params),
            },
          },
        },
        { provide: UsersService, useValue: { getProfiles } },
        { provide: RolesService, useValue: { getUserRoles, getRoles } },
        { provide: PermissionsService, useValue: { getPermissions } },
      ],
    }).compileComponents();
  }

  it('auto-inspects the requested profile from query params', async () => {
    await configureWithQueryParams({
      profileId: 'profile-1',
      source: 'users',
    });

    const fixture = TestBed.createComponent(PermissionsInspectorComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    expect(component.selectedProfileId()).toBe('profile-1');
    expect(component.selectedPermissionInfo()).toEqual(
      expect.objectContaining({
        profileId: 'profile-1',
        profileName: 'Operator One',
        roles: ['owner_console_owner'],
      })
    );
    expect(component.traceContextLabel()).toContain('Users Management');
  });

  it('filters all-profile inspection to the requested role context', async () => {
    await configureWithQueryParams({
      roleId: 'role-1',
      roleName: 'owner_console_owner',
      source: 'roles',
    });

    const fixture = TestBed.createComponent(PermissionsInspectorComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    expect(component.allProfilesData()).toHaveLength(1);
    expect(component.allProfilesData()[0].profileId).toBe('profile-1');
    expect(component.traceContextLabel()).toContain('owner_console_owner');
  });
});
