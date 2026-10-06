import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';
import { LandingComponent } from './components/landing/landing.component';
import { PrivateCloudPageComponent } from './pages/private-cloud/private-cloud-page.component';
import { PrivateCloudHomePageComponent } from './pages/private-cloud-home/private-cloud-home-page.component';
import { PrivateCloudOrganizationsPageComponent } from './pages/private-cloud-organizations/private-cloud-organizations-page.component';
import { OpenSourceStackPageComponent } from './pages/open-source-stack/open-source-stack-page.component';
import { TurnKeyAppliancesPageComponent } from './pages/turn-key-appliances/turn-key-appliances-page.component';
import { SoftwareStacksPageComponent } from './pages/software-stacks/software-stacks-page.component';
import { CustomSoftwarePageComponent } from './pages/custom-software/custom-software-page.component';
import { PartnersPageComponent } from './pages/partners/partners-page.component';
import { HowWeWorkPageComponent } from './pages/how-we-work/how-we-work-page.component';
import { ContactPageComponent } from './pages/contact/contact-page.component';
import { CostComparisonPageComponent } from './pages/cost-comparison/cost-comparison-page.component';
import { PlaceholderPageComponent } from './pages/placeholder/placeholder-page.component';
import { LABOR_RATE_PER_HOUR } from './content/pricing';

/**
 * D022: the only fixed price the site states is the published labor rate.
 * Hardware, freight, tax, leases, and projects are quoted from actual costs.
 */
describe('honest pricing', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideRouter([]),
        {
          provide: HaiAppDirectoryService,
          useValue: { getResolvedApps: () => of([]) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { eyebrow: 'x', title: 'x', summary: 'x', links: [] },
            },
          },
        },
      ],
    });
  });

  it.each([
    LandingComponent,
    PrivateCloudPageComponent,
    PrivateCloudHomePageComponent,
    PrivateCloudOrganizationsPageComponent,
    OpenSourceStackPageComponent,
    TurnKeyAppliancesPageComponent,
    SoftwareStacksPageComponent,
    CustomSoftwarePageComponent,
    PartnersPageComponent,
    HowWeWorkPageComponent,
    ContactPageComponent,
    CostComparisonPageComponent,
    PlaceholderPageComponent,
  ] as Type<unknown>[])('%p states no price but the labor rate', (page) => {
    const fixture = TestBed.createComponent(page);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    const prices = text.match(/\$\s?\d[\d,.]*/g) ?? [];

    expect(
      prices.filter((price) => price !== `$${LABOR_RATE_PER_HOUR}`)
    ).toEqual([]);
    expect(text).not.toMatch(/\bmargin\b|markup of|\/mo\b/i);
  });
});
