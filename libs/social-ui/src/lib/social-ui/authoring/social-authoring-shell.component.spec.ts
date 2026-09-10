import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SocialAuthoringShellComponent } from './social-authoring-shell.component';

describe('SocialAuthoringShellComponent', () => {
  let fixture: ComponentFixture<SocialAuthoringShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialAuthoringShellComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SocialAuthoringShellComponent);
  });

  it('projects ready social authoring without identity inputs', () => {
    fixture.componentRef.setInput('workspaceId', 'community-north-star');
    fixture.componentRef.setInput('state', 'ready');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Community activity');
    expect(
      fixture.nativeElement.querySelector('[data-authoring-ready]')
    ).toBeTruthy();
  });
});
