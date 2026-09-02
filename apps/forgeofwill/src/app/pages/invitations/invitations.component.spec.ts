import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';

import { InvitationsComponent } from './invitations.component';
import { ProjectInvite, ProjectService } from '../../project/project.service';

function invite(overrides: Partial<ProjectInvite> = {}): ProjectInvite {
  return {
    id: 'inv-1',
    projectId: 'proj-1',
    email: 'me@example.test',
    status: 'PENDING',
    ...overrides,
  };
}

describe('InvitationsComponent', () => {
  let fixture: ComponentFixture<InvitationsComponent>;
  let component: InvitationsComponent;
  let projectService: {
    getMyInvitations: jest.Mock;
    respondToInvitation: jest.Mock;
  };

  async function setup(invites: ProjectInvite[]) {
    projectService = {
      getMyInvitations: jest.fn().mockReturnValue(of(invites)),
      respondToInvitation: jest
        .fn()
        .mockReturnValue(of(invite({ status: 'ACCEPTED' }))),
    };

    await TestBed.configureTestingModule({
      imports: [InvitationsComponent],
      providers: [{ provide: ProjectService, useValue: projectService }],
    }).compileComponents();

    fixture = TestBed.createComponent(InvitationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('shows accept and decline buttons for a pending invitation', async () => {
    await setup([invite({ projectName: 'Longbow' })]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Longbow');

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    );
    expect(buttons.length).toBe(2);
    expect(text).toContain('Accept');
    expect(text).toContain('Decline');
  });

  it('falls back to "a project" when projectName is missing', async () => {
    await setup([invite({ projectName: undefined })]);

    expect(fixture.nativeElement.textContent).toContain('a project');
  });

  it('shows no buttons and the outcome in words for a non-pending invitation', async () => {
    await setup([invite({ status: 'ACCEPTED', projectName: 'Longbow' })]);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('you joined');
  });

  it('shows the right outcome words for declined, revoked and left', async () => {
    await setup([
      invite({ id: 'a', status: 'DECLINED' }),
      invite({ id: 'b', status: 'REVOKED' }),
      invite({ id: 'c', status: 'LEFT' }),
    ]);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('you said no');
    expect(text).toContain('withdrawn');
    expect(text).toContain('you left');
  });

  it('shows the empty state when there are no invitations', async () => {
    await setup([]);

    expect(fixture.nativeElement.textContent).toContain(
      'Nothing is waiting for you.'
    );
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('shows a plain error line when loading fails', async () => {
    projectService = {
      getMyInvitations: jest
        .fn()
        .mockReturnValue(throwError(() => new Error('nope'))),
      respondToInvitation: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [InvitationsComponent],
      providers: [{ provide: ProjectService, useValue: projectService }],
    }).compileComponents();
    fixture = TestBed.createComponent(InvitationsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Your invitations could not be loaded. Please try again.'
    );
  });

  it('calls respondToInvitation with (id, true) on accept and reloads', async () => {
    await setup([invite({ id: 'inv-42', projectName: 'Longbow' })]);
    projectService.getMyInvitations.mockReturnValue(of([]));

    const acceptButton = fixture.nativeElement.querySelectorAll(
      'button'
    )[0] as HTMLButtonElement;
    acceptButton.click();
    fixture.detectChanges();

    expect(projectService.respondToInvitation).toHaveBeenCalledWith(
      'inv-42',
      true
    );
    expect(projectService.getMyInvitations).toHaveBeenCalledTimes(2);
  });

  it('calls respondToInvitation with (id, false) on decline', async () => {
    await setup([invite({ id: 'inv-42', projectName: 'Longbow' })]);

    const declineButton = fixture.nativeElement.querySelectorAll(
      'button'
    )[1] as HTMLButtonElement;
    declineButton.click();
    fixture.detectChanges();

    expect(projectService.respondToInvitation).toHaveBeenCalledWith(
      'inv-42',
      false
    );
  });

  it('disables both buttons on the invitation being answered until the response arrives', async () => {
    await setup([invite({ id: 'inv-42', projectName: 'Longbow' })]);
    const pending = new Subject<ProjectInvite>();
    projectService.respondToInvitation.mockReturnValue(pending);

    let buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    );
    buttons[0].click();
    fixture.detectChanges();

    buttons = Array.from(fixture.nativeElement.querySelectorAll('button'));
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);

    pending.next(invite({ id: 'inv-42', status: 'ACCEPTED' }));
    pending.complete();
    fixture.detectChanges();
  });

  it('shows a plain error line when answering fails', async () => {
    await setup([invite({ id: 'inv-42', projectName: 'Longbow' })]);
    projectService.respondToInvitation.mockReturnValue(
      throwError(() => new Error('nope'))
    );

    const acceptButton = fixture.nativeElement.querySelectorAll(
      'button'
    )[0] as HTMLButtonElement;
    acceptButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'That answer could not be sent. Please try again.'
    );
  });
});
