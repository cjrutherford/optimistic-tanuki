import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PrivateCloudPageComponent } from './private-cloud-page.component';
import {
  CAPABILITY_QUALIFIER,
  FREEDOM_PRINCIPLE,
  PRIVATE_CLOUD_CAPABILITY_LIST,
  PRIVATE_CLOUD_STEPS,
} from '../../content/private-cloud';

describe('PrivateCloudPageComponent', () => {
  let fixture: ComponentFixture<PrivateCloudPageComponent>;
  let element: HTMLElement;

  const hrefs = (selector: string) =>
    Array.from(element.querySelectorAll(selector)).map((link) =>
      link.getAttribute('href')
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrivateCloudPageComponent, HttpClientTestingModule],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(PrivateCloudPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('leads with the approved headline and a single h1', () => {
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toBe(
      'A cloud you control.'
    );
  });

  it('points every primary action at the assessment', () => {
    expect(hrefs('.intro-action, .primary-action')).toEqual([
      '/private-cloud/assessment',
      '/private-cloud/assessment',
    ]);
  });

  it('lists the capabilities with the configuration qualifier', () => {
    expect(element.querySelectorAll('#capabilities h3')).toHaveLength(
      PRIVATE_CLOUD_CAPABILITY_LIST.length
    );
    expect(element.querySelector('#capabilities .qualifier')?.textContent).toBe(
      CAPABILITY_QUALIFIER
    );
  });

  it('offers the home and organization paths', () => {
    expect(hrefs('#audiences a')).toEqual([
      '/private-cloud/home',
      '/private-cloud/organizations',
    ]);
    const organizations = element.querySelectorAll('#audiences article')[1];
    expect(organizations.textContent).toContain('Faith groups');
    expect(element.textContent).not.toMatch(/church/i);
  });

  it('summarizes how it works and links to the full process', () => {
    expect(element.querySelectorAll('#how-it-works li')).toHaveLength(
      PRIVATE_CLOUD_STEPS.length
    );
    expect(hrefs('#how-it-works a')).toEqual(['/how-we-work']);
  });

  it('keeps the freedom principle prominent and links to the stack', () => {
    expect(element.querySelector('#freedom h2')?.textContent).toBe(
      FREEDOM_PRINCIPLE
    );
    expect(hrefs('#freedom a')).toEqual(['/private-cloud/open-source-stack']);
  });

  it('carries the independent-infrastructure section', () => {
    expect(element.querySelector('#infrastructure')).not.toBeNull();
  });

  it('offers contact as the secondary route in the closing panel', () => {
    expect(hrefs('.cta-panel .secondary a')).toEqual(['/contact']);
  });

  it('avoids prohibited claims', () => {
    expect(element.textContent).not.toMatch(
      /unhackable|impossible to breach|guaranteed (savings|uptime)|always cheaper/i
    );
  });
});
