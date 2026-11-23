import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppBarComponent } from './app-bar.component';

describe('AppBarComponent', () => {
  let fixture: ComponentFixture<AppBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppBarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AppBarComponent);
    fixture.detectChanges();
  });

  it('owns one labelled non-banner landmark without nesting consumer landmarks', () => {
    const host = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('appTitle', 'Forge of Will');
    fixture.detectChanges();
    const region = host.querySelector('[role="region"]');

    expect(region?.getAttribute('aria-label')).toBe(
      'Forge of Will application bar'
    );
    expect(host.querySelectorAll('header, [role="banner"]')).toHaveLength(0);
    expect(region?.querySelector('header, [role="banner"]')).toBeNull();
  });

  describe('actions slot', () => {
    @Component({
      standalone: true,
      imports: [AppBarComponent],
      template: `
        <otui-app-bar appTitle="Test">
          <div appBarActions><button type="button">Sign out</button></div>
          <span class="unmarked">not projected</span>
        </otui-app-bar>
      `,
    })
    class HostComponent {}

    it('projects only [appBarActions] content', async () => {
      await TestBed.resetTestingModule()
        .configureTestingModule({ imports: [HostComponent] })
        .compileComponents();
      const host = TestBed.createComponent(HostComponent);
      host.detectChanges();
      const el: HTMLElement = host.nativeElement;
      expect(el.querySelector('[appBarActions] button')?.textContent).toBe(
        'Sign out'
      );
      expect(el.querySelector('.unmarked')).toBeNull();
    });
  });
});
