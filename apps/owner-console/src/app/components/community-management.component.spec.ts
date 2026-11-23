import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';

import { CommunityManagementComponent } from './community-management.component';
import { CommunityService } from '../services/community.service';
import {
  createOwnerConfirmStub,
  OwnerConfirmStub,
} from './owner-confirm.testing';

interface CommunityServiceDouble {
  getCommunities: jest.Mock;
  deleteCommunity: jest.Mock;
}

const community = {
  id: 'community-1',
  name: 'Makers Guild',
  description: 'A collaborative community.',
  memberCount: 3,
  joinPolicy: 'PUBLIC',
  createdAt: new Date().toISOString(),
};

describe('CommunityManagementComponent', () => {
  let communityService: CommunityServiceDouble;
  let confirmStub: OwnerConfirmStub;
  const messageService = { clearMessages: jest.fn(), addMessage: jest.fn() };
  let fixture: ComponentFixture<CommunityManagementComponent>;

  const render = () => {
    fixture = TestBed.createComponent(CommunityManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    jest.clearAllMocks();
    communityService = {
      getCommunities: jest.fn().mockReturnValue(of([community])),
      deleteCommunity: jest.fn().mockReturnValue(of(undefined)),
    };
    confirmStub = createOwnerConfirmStub();
    await TestBed.configureTestingModule({
      imports: [CommunityManagementComponent],
      providers: [
        provideRouter([]),
        { provide: CommunityService, useValue: communityService },
        { provide: MessageService, useValue: messageService },
        { provide: OwnerConfirmService, useValue: confirmStub },
      ],
    }).compileComponents();
  });

  it('renders a page heading', () => {
    render();

    expect(html().querySelector('h1')?.textContent).toContain('Communities');
  });

  it('provides a keyboard-operable control to open each community', () => {
    render();

    expect(html().querySelector('button.community-card__open')).toBeTruthy();
  });

  it('renders records with a null description without throwing', () => {
    communityService.getCommunities.mockReturnValue(
      of([
        { ...community, description: null },
        { id: 'c2', name: 'Bare' },
      ])
    );

    expect(() => render()).not.toThrow();
    expect(html().querySelectorAll('.community-card')).toHaveLength(2);
  });

  it('shows Unavailable with Retry when the load fails, and recovers', () => {
    communityService.getCommunities.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'down' } }))
    );
    const component = render();

    expect(component.loadError).toBe('down');
    expect(html().textContent).toContain('Unavailable');
    (
      html().querySelector('ot-owner-state button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(communityService.getCommunities).toHaveBeenCalledTimes(2);
    expect(html().querySelector('.community-card')).toBeTruthy();
  });

  it('treats a non-array reply as an empty list', () => {
    communityService.getCommunities.mockReturnValue(of({ message: 'x' }));

    render();

    expect(html().textContent).toContain('No communities exist yet.');
  });

  it('requires typing the name to delete, then reloads', async () => {
    const component = render();

    await component.deleteCommunity(community as never);

    expect(confirmStub.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'typed',
        typedPhrase: 'Makers Guild',
        destructive: true,
      })
    );
    expect(communityService.deleteCommunity).toHaveBeenCalledWith(
      'community-1'
    );
    expect(communityService.getCommunities).toHaveBeenCalledTimes(2);
  });

  it('does not delete when the confirmation is declined', async () => {
    confirmStub.confirm.mockResolvedValue({ confirmed: false });
    const component = render();

    await component.deleteCommunity(community as never);

    expect(communityService.deleteCommunity).not.toHaveBeenCalled();
  });
});
