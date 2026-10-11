import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TurnKeyAppliancesPageComponent } from './turn-key-appliances-page.component';
import { DEFAULT_HARDWARE_TIERS } from '../../services/hardware-catalog.service';

describe('TurnKeyAppliancesPageComponent', () => {
  let fixture: ComponentFixture<TurnKeyAppliancesPageComponent>;
  let element: HTMLElement;

  const hrefs = (selector: string) =>
    Array.from(element.querySelectorAll(selector)).map((link) =>
      link.getAttribute('href')
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TurnKeyAppliancesPageComponent, HttpClientTestingModule],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(TurnKeyAppliancesPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('has one visible h1 and the audit action going to contact', () => {
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.classList).not.toContain(
      'visually-hidden'
    );
    expect(hrefs('.intro-action')).toEqual(['/contact']);
  });

  it('keeps the existing appliance catalog', () => {
    expect(element.querySelector('#appliances')).not.toBeNull();
    expect(element.querySelector('hai-hardware-catalog')).not.toBeNull();
  });

  it('makes both appliance families reachable from the intro', () => {
    expect(hrefs('.intro-link')).toEqual([
      '/turn-key-appliances#appliances',
      '/turn-key-appliances#private-cloud-appliances',
    ]);
  });

  it('adds a private cloud appliance category in capability tiers', () => {
    const section = element.querySelector('#private-cloud-appliances');

    expect(section).not.toBeNull();
    expect(
      Array.from(section?.querySelectorAll('h3') ?? []).map(
        (title) => title.textContent
      )
    ).toEqual([
      'Household private cloud',
      'Team private cloud',
      'Expanded private cloud',
    ]);
    expect(section?.querySelector('.note')?.textContent).toMatch(
      /chosen after the assessment/
    );
  });

  it('sells capabilities, not specific models or prices', () => {
    const text =
      element.querySelector('#private-cloud-appliances')?.textContent ?? '';
    const models = DEFAULT_HARDWARE_TIERS.flatMap((tier) =>
      tier.hardware.split(/[(),]/).map((part) => part.trim())
    ).filter((part) => part.length > 6);

    expect(text).not.toMatch(/\$\s?\d/);
    for (const model of models) {
      expect(text).not.toContain(model);
    }
  });

  it('cross-links to the private cloud pages and the assessment', () => {
    expect(hrefs('#private-cloud-appliances a')).toEqual([
      '/private-cloud/home',
      '/private-cloud/organizations',
      '/private-cloud/organizations',
    ]);
    expect(hrefs('.appliance-links a')).toEqual([
      '/private-cloud',
      '/private-cloud/open-source-stack',
      '/private-cloud/assessment',
    ]);
  });
});
