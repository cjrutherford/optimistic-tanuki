import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { NavigationService } from '@optimistic-tanuki/app-registry';
import { TitleBarComponent } from './title-bar.component';

describe('TitleBarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        { provide: Router, useValue: { url: '/', events: of() } },
        { provide: NavigationService, useValue: {} },
      ],
    });
  });

  it('exposes the business narrative anchors in the menu', () => {
    const component =
      TestBed.createComponent(TitleBarComponent).componentInstance;
    const labels = component.navItems.map((item) => item.label);

    expect(labels).toEqual([
      'Home',
      'Turn-key Appliances',
      'Software Stacks',
      'Cost Comparison',
      'Contact',
    ]);
  });

  it('renders brand logo and title, nav links, and primary action button', () => {
    const fixture = TestBed.createComponent(TitleBarComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('HOPEFUL ASPIRATIONS INDUSTRIES');
    expect(compiled.textContent).toContain('Home');
    expect(compiled.textContent).toContain('Turn-key Appliances');
    expect(compiled.textContent).toContain('Software Stacks');
    expect(compiled.textContent).toContain('Cost Comparison');
    expect(compiled.textContent).toContain('Contact');
    expect(compiled.textContent).toContain('Schedule Free Audit');
  });
});
