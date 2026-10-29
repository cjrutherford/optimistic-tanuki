import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ManageMembersComponent } from './manage-members.component';
import { CommunityService } from '../services/community.service';

describe('Community member management identity', () => {
  it('uses approved profile membership for owner and manager actions', () => {
    TestBed.configureTestingModule({
      imports: [ManageMembersComponent],
      providers: [
        { provide: CommunityService, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: {} },
      ],
    });
    const component = TestBed.createComponent(
      ManageMembersComponent
    ).componentInstance;
    component.currentUserId = 'owner-profile';
    component.community.set({
      ownerId: 'owner-account',
      ownerProfileId: 'owner-profile',
    } as any);
    component.members.set([
      {
        profileId: 'owner-profile',
        userId: 'owner-account',
        role: 'owner',
        status: 'approved',
      } as any,
    ]);
    expect(component.isAdmin()).toBe(true);
    component.members.set([
      { profileId: 'owner-profile', role: 'admin', status: 'approved' } as any,
    ]);
    expect(component.isAdmin()).toBe(true);
    component.members.set([
      { profileId: 'owner-profile', role: 'owner', status: 'pending' } as any,
    ]);
    expect(component.isAdmin()).toBe(false);
  });
});
