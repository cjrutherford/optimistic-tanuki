import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NavigationService } from '@optimistic-tanuki/app-registry';
import { TitleBarComponent } from './title-bar.component';

describe('TitleBarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        { provide: Router, useValue: { url: '/' } },
        { provide: NavigationService, useValue: {} },
      ],
    });
  });

  it('exposes the business narrative anchors in the menu', () => {
    const component =
      TestBed.createComponent(TitleBarComponent).componentInstance;
    const labels = component.navItems.map((item) => item.label);

    expect(labels).toEqual([
      'Services',
      'Digital Sovereignty',
      'Infrastructure',
      'Engagement Model',
      'Partner With HAI',
      'Start a Project',
    ]);
  });
});
