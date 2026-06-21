import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { SettingsShellComponent } from './settings-shell.component';

@Component({
  standalone: true,
  imports: [SettingsShellComponent],
  template: `
    <lib-settings-shell
      title="Settings"
      description="Keep your profile current and tune the workspace."
      profileName="Jordan Vale"
      profileImage="profile.png"
      backgroundImage="cover.png"
      defaultName="Jordan Vale"
      [hasThemeSection]="true"
      [profile]="null"
    >
      <div settings-theme>
        <p>Projected theme content</p>
      </div>
    </lib-settings-shell>
  `,
})
class TestHostComponent {}

describe('SettingsShellComponent', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollTo', {
      value: jest.fn(),
      writable: true,
    });
  });

  it('renders projected theme content and opens the profile editor from the profile card', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Projected theme content');

    const trigger = fixture.debugElement.query(
      By.css('[data-profile-editor-trigger]')
    );
    trigger.nativeElement.click();
    fixture.detectChanges();

    const editor = fixture.debugElement.query(
      By.directive(SettingsShellComponent)
    ).componentInstance as SettingsShellComponent;
    expect(editor.showProfileEditor()).toBe(true);
  });
});
