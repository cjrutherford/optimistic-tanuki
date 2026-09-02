import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  ProjectMembersComponent,
  ProjectPerson,
} from './project-members.component';

/**
 * The rule this component exists to enforce: an owner can never be removed,
 * and removal is only ever offered to an owner looking at someone else. A
 * test on class properties alone would not catch a stray button in the
 * template, so these assert on what actually renders.
 */
describe('ProjectMembersComponent', () => {
  let fixture: ComponentFixture<ProjectMembersComponent>;
  let component: ProjectMembersComponent;

  function people(): ProjectPerson[] {
    return [
      { profileId: 'owner-1', name: 'Ada Lovelace', isOwner: true },
      { profileId: 'member-1', name: 'Grace Hopper', isOwner: false },
      { profileId: 'member-2', name: 'Ida Lovelace', isOwner: false },
    ];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectMembersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectMembersComponent);
    component = fixture.componentInstance;
  });

  function render() {
    fixture.detectChanges();
  }

  function removeButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button.remove'));
  }

  function leaveButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button.leave');
  }

  it('marks the owner as owner and never gives them a remove button', () => {
    component.people = people();
    component.viewerIsOwner = true;
    component.viewerProfileId = 'owner-1';
    render();

    const ownerRow = Array.from(
      fixture.nativeElement.querySelectorAll('li.person')
    ).find((row) =>
      (row as HTMLElement).textContent?.includes('Ada Lovelace')
    ) as HTMLElement;

    expect(ownerRow.textContent).toContain('Owner');
    expect(ownerRow.querySelector('button.remove')).toBeNull();
  });

  it('offers a remove button next to each non-owner when the viewer owns the project', () => {
    component.people = people();
    component.viewerIsOwner = true;
    component.viewerProfileId = 'owner-1';
    render();

    // One owner, two non-owners: exactly two remove buttons, never one for the owner.
    expect(removeButtons().length).toBe(2);
  });

  it('shows no remove buttons at all to a non-owner viewer', () => {
    component.people = people();
    component.viewerIsOwner = false;
    component.viewerProfileId = 'member-1';
    render();

    expect(removeButtons().length).toBe(0);
  });

  it('emits the profileId of the person removed', () => {
    component.people = people();
    component.viewerIsOwner = true;
    component.viewerProfileId = 'owner-1';
    render();

    const emitted: string[] = [];
    component.removed.subscribe((id) => emitted.push(id));

    removeButtons()[0].click();

    expect(emitted.length).toBe(1);
    expect(['member-1', 'member-2']).toContain(emitted[0]);
  });

  it('offers "Leave this project" to a member who is not the owner', () => {
    component.people = people();
    component.viewerIsOwner = false;
    component.viewerProfileId = 'member-1';
    render();

    const button = leaveButton();
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('Leave this project');
  });

  it('does not offer to leave when the viewer is the owner', () => {
    component.people = people();
    component.viewerIsOwner = true;
    component.viewerProfileId = 'owner-1';
    render();

    expect(leaveButton()).toBeNull();
  });

  it('does not offer to leave when the viewer is not on the project at all', () => {
    component.people = people();
    component.viewerIsOwner = false;
    component.viewerProfileId = 'someone-else';
    render();

    expect(leaveButton()).toBeNull();
  });

  it('emits when the leave button is pressed', () => {
    component.people = people();
    component.viewerIsOwner = false;
    component.viewerProfileId = 'member-1';
    render();

    let emitted = 0;
    component.left.subscribe(() => emitted++);

    leaveButton()?.click();

    expect(emitted).toBe(1);
  });

  it('falls back to the profileId when a person has no name', () => {
    component.people = [
      { profileId: 'no-name-id', isOwner: false },
      ...people(),
    ];
    component.viewerIsOwner = false;
    component.viewerProfileId = 'no-name-id';
    render();

    expect(fixture.nativeElement.textContent).toContain('no-name-id');
  });

  it('renders no rows and no leave button when there are no people', () => {
    component.people = [];
    component.viewerIsOwner = false;
    component.viewerProfileId = 'anyone';
    render();

    expect(fixture.nativeElement.querySelectorAll('li.person').length).toBe(0);
    expect(leaveButton()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Nobody is on this project yet.'
    );
  });
});
