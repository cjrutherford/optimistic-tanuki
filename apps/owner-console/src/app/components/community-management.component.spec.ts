import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CommunityManagementComponent } from './community-management.component';
import { CommunityService } from '../services/community.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

describe('CommunityManagementComponent', () => {
  const communityService = {
    getCommunities: jest.fn(),
    deleteCommunity: jest.fn(),
  };
  const messageService = { clearMessages: jest.fn(), addMessage: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    communityService.getCommunities.mockReturnValue(
      of([
        {
          id: 'community-1',
          name: 'Makers Guild',
          description: 'A collaborative community.',
          memberCount: 3,
          joinPolicy: 'PUBLIC',
          createdAt: new Date().toISOString(),
        },
      ])
    );
    await TestBed.configureTestingModule({
      imports: [CommunityManagementComponent],
      providers: [
        provideRouter([]),
        { provide: CommunityService, useValue: communityService },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();
  });

  it('provides a keyboard-operable control to open each community', () => {
    const fixture = TestBed.createComponent(CommunityManagementComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('button.community-card__open')
    ).toBeTruthy();
  });
});
