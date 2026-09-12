import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForumAuthoringShellComponent } from './forum-authoring-shell.component';

describe('ForumAuthoringShellComponent', () => {
  let fixture: ComponentFixture<ForumAuthoringShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForumAuthoringShellComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ForumAuthoringShellComponent);
  });

  it('offers discussion creation for an empty canonical workspace', () => {
    fixture.componentRef.setInput('workspaceId', 'community-north-star');
    fixture.componentRef.setInput('state', 'empty');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Create discussion');
    expect(
      fixture.nativeElement.querySelector('[data-authoring-empty]')
    ).toBeTruthy();
  });
});
