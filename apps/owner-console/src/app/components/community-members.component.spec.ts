import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { CommunityMembersComponent } from './community-members.component';
import { CommunityService } from '../services/community.service';

describe('CommunityMembersComponent', () => {
  let router: Router;
  let communityService: {
    getCommunityMembers: jest.Mock;
    getCommunityManager: jest.Mock;
    appointManager: jest.Mock;
    revokeManager: jest.Mock;
    updateMemberRole: jest.Mock;
    removeMember: jest.Mock;
    inviteMember: jest.Mock;
  };
  let messageService: {
    addMessage: jest.Mock;
  };

  beforeEach(async () => {
    communityService = {
      getCommunityMembers: jest.fn().mockReturnValue(
        of([
          {
            id: 'member-1',
            userId: 'user-1',
            profileId: 'profile-1',
            role: 'member',
            status: 'approved',
            joinedAt: new Date().toISOString(),
          },
        ])
      ),
      getCommunityManager: jest.fn().mockReturnValue(of(null)),
      appointManager: jest.fn().mockReturnValue(of({ profileId: 'profile-1' })),
      revokeManager: jest.fn().mockReturnValue(of(undefined)),
      updateMemberRole: jest.fn().mockReturnValue(of({})),
      removeMember: jest.fn().mockReturnValue(of(undefined)),
      inviteMember: jest.fn().mockReturnValue(of({})),
    };

    messageService = {
      addMessage: jest.fn(),
    };

    TestBed.overrideComponent(CommunityMembersComponent, {
      set: {
        template: '<div></div>',
      },
    });

    await TestBed.configureTestingModule({
      imports: [CommunityMembersComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'community-1' }),
            },
          },
        },
        { provide: CommunityService, useValue: communityService },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('loads manager state alongside community members', () => {
    const fixture = TestBed.createComponent(CommunityMembersComponent);
    fixture.detectChanges();

    expect(communityService.getCommunityMembers).toHaveBeenCalledWith(
      'community-1'
    );
    expect(communityService.getCommunityManager).toHaveBeenCalledWith(
      'community-1'
    );
  });

  it('treats an unassigned manager as a normal empty state without an error toast', () => {
    const fixture = TestBed.createComponent(CommunityMembersComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.currentManager).toBeNull();
    expect(messageService.addMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Failed to load community manager.',
        type: 'error',
      })
    );
  });

  it('does not show an error toast when manager lookup returns not found', () => {
    communityService.getCommunityManager.mockReturnValue(
      throwError(() => ({ status: 404 }))
    );

    const fixture = TestBed.createComponent(CommunityMembersComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.currentManager).toBeNull();
    expect(messageService.addMessage).not.toHaveBeenCalled();
  });

  it('appoints a community manager from the member governance surface', () => {
    const fixture = TestBed.createComponent(CommunityMembersComponent);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.appointManager({
      userId: 'user-1',
      profileId: 'profile-1',
    });

    expect(communityService.appointManager).toHaveBeenCalledWith(
      'community-1',
      {
        userId: 'user-1',
        profileId: 'profile-1',
      }
    );
    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'Community manager appointed successfully.',
      type: 'success',
    });
  });

  it('revokes the current community manager', () => {
    communityService.getCommunityManager.mockReturnValue(
      of({ userId: 'user-1', profileId: 'profile-1' })
    );

    const fixture = TestBed.createComponent(CommunityMembersComponent);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.revokeManager();

    expect(communityService.revokeManager).toHaveBeenCalledWith('community-1');
    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'Community manager revoked successfully.',
      type: 'success',
    });
  });

  it('surfaces permission-aware manager appointment failures', () => {
    communityService.appointManager.mockReturnValue(
      throwError(() => ({
        error: {
          message: 'Permission denied: community.manage in app scope local-hub',
        },
      }))
    );

    const fixture = TestBed.createComponent(CommunityMembersComponent);
    const component = fixture.componentInstance as any;
    fixture.detectChanges();

    component.appointManager({
      userId: 'user-1',
      profileId: 'profile-1',
    });

    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'Permission denied: community.manage in app scope local-hub',
      type: 'error',
    });
  });
});
