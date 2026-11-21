import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DirectoryNearbyTownsComponent } from './directory-nearby-towns.component';

describe('DirectoryNearbyTownsComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([])] })
  );

  it('links each town to its directory with its distance', () => {
    const fixture = TestBed.createComponent(DirectoryNearbyTownsComponent);
    fixture.componentRef.setInput('towns', [
      { name: 'Alpha', slug: 'alpha', adminArea: 'AA', distanceMiles: 12.4 },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a')?.getAttribute('href')).toBe(
      '/city/alpha/businesses'
    );
    expect(el.textContent).toContain('12 mi');
    expect(el.querySelector('nav')?.getAttribute('aria-labelledby')).toBe(
      el.querySelector('h2')?.id
    );
  });

  it('says so when no other town is available', () => {
    const fixture = TestBed.createComponent(DirectoryNearbyTownsComponent);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="nearby-empty"]')
    ).not.toBeNull();
  });
});
