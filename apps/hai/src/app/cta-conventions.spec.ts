import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';
import { TitleBarComponent } from './components/title-bar/title-bar.component';
import { LandingComponent } from './components/landing/landing.component';
import { PrivateCloudPageComponent } from './pages/private-cloud/private-cloud-page.component';
import { PrivateCloudHomePageComponent } from './pages/private-cloud-home/private-cloud-home-page.component';
import { PrivateCloudOrganizationsPageComponent } from './pages/private-cloud-organizations/private-cloud-organizations-page.component';
import { OpenSourceStackPageComponent } from './pages/open-source-stack/open-source-stack-page.component';
import { TurnKeyAppliancesPageComponent } from './pages/turn-key-appliances/turn-key-appliances-page.component';
import { SoftwareStacksPageComponent } from './pages/software-stacks/software-stacks-page.component';
import { CostComparisonPageComponent } from './pages/cost-comparison/cost-comparison-page.component';
import { AssessmentPageComponent } from './pages/assessment/assessment-page.component';

/**
 * D017: a "free audit" always opens the contact form; an "assessment" always
 * opens the private-cloud assessment form.
 */
describe('call-to-action conventions', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideRouter([]),
        {
          provide: HaiAppDirectoryService,
          useValue: { getResolvedApps: () => of([]) },
        },
      ],
    });
  });

  it.each([
    TitleBarComponent,
    LandingComponent,
    PrivateCloudPageComponent,
    PrivateCloudHomePageComponent,
    PrivateCloudOrganizationsPageComponent,
    OpenSourceStackPageComponent,
    TurnKeyAppliancesPageComponent,
    SoftwareStacksPageComponent,
    CostComparisonPageComponent,
    AssessmentPageComponent,
  ] as Type<unknown>[])(
    '%p routes audits and assessments correctly',
    (page) => {
      const fixture = TestBed.createComponent(page);
      fixture.detectChanges();
      const links = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('a')
      );

      for (const link of links) {
        const text = link.textContent ?? '';
        if (/audit/i.test(text)) {
          expect([text.trim(), link.getAttribute('href')]).toEqual([
            text.trim(),
            '/contact',
          ]);
        }
        if (/assessment/i.test(text)) {
          expect([text.trim(), link.getAttribute('href')]).toEqual([
            text.trim(),
            '/private-cloud/assessment',
          ]);
        }
      }
    }
  );
});
