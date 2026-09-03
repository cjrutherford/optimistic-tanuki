import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  ProjectInvite,
  ProjectInviteListComponent,
} from './invite-list.component';

/**
 * What a reader sees for each invite, and which ones can still be undone.
 * The distinction between a finished status and an open one is the whole
 * point of the withdraw button, so it is checked against the rendered DOM
 * rather than the component's own boolean.
 */
describe('ProjectInviteListComponent', () => {
  let fixture: ComponentFixture<ProjectInviteListComponent>;
  let component: ProjectInviteListComponent;

  function invite(overrides: Partial<ProjectInvite> = {}): ProjectInvite {
    return {
      id: 'i1',
      email: 'someone@example.com',
      status: 'PENDING',
      ...overrides,
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectInviteListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectInviteListComponent);
    component = fixture.componentInstance;
  });

  it('says nobody has been invited yet when the list is empty', () => {
    component.invites = [];
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Nobody has been invited yet.'
    );
  });

  it('shows each address', () => {
    component.invites = [
      invite({ id: 'a', email: 'alice@example.com' }),
      invite({ id: 'b', email: 'bob@example.com' }),
    ];
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('alice@example.com');
    expect(text).toContain('bob@example.com');
  });

  it('shows each status in plain words, not the constant', () => {
    component.invites = [
      invite({ id: 'a', status: 'PENDING' }),
      invite({ id: 'b', status: 'ACCEPTED' }),
      invite({ id: 'c', status: 'DECLINED' }),
      invite({ id: 'd', status: 'REVOKED' }),
      invite({ id: 'e', status: 'LEFT' }),
    ];
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('waiting for an answer');
    expect(text).toContain('on the project');
    expect(text).toContain('said no');
    expect(text).toContain('withdrawn');
    expect(text).toContain('left the project');
    expect(text).not.toContain('PENDING');
    expect(text).not.toContain('ACCEPTED');
    expect(text).not.toContain('DECLINED');
    expect(text).not.toContain('REVOKED');
    expect(text).not.toContain('LEFT');
  });

  it('offers a withdraw button for a pending invite', () => {
    component.invites = [invite({ status: 'PENDING' })];
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.withdraw');
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Withdraw');
  });

  it('offers a withdraw button for an accepted invite', () => {
    component.invites = [invite({ status: 'ACCEPTED' })];
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('button.withdraw')
    ).not.toBeNull();
  });

  it('offers nothing for a declined, revoked, or left invite', () => {
    component.invites = [
      invite({ id: 'a', status: 'DECLINED' }),
      invite({ id: 'b', status: 'REVOKED' }),
      invite({ id: 'c', status: 'LEFT' }),
    ];
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('button.withdraw').length
    ).toBe(0);
  });

  it('emits the id of the invite that was withdrawn', () => {
    component.invites = [
      invite({ id: 'a', status: 'PENDING' }),
      invite({ id: 'b', status: 'ACCEPTED', email: 'bob@example.com' }),
    ];
    fixture.detectChanges();

    const revoked: string[] = [];
    component.revoked.subscribe((id) => revoked.push(id));

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button.withdraw')
    );
    buttons[1].click();

    expect(revoked).toEqual(['b']);
  });
});
