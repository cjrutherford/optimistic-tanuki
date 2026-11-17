import { TestBed } from '@angular/core/testing';
import { DirectoryBadgeComponent } from './directory-badge.component';

describe('DirectoryBadgeComponent', () => {
  it.each([
    ['business-page', 'Business page'],
    ['directory-listing', 'Directory listing (not claimed)'],
  ] as const)('labels %s', (kind, text) => {
    const fixture = TestBed.createComponent(DirectoryBadgeComponent);
    fixture.componentRef.setInput('kind', kind);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe(text);
  });
});
