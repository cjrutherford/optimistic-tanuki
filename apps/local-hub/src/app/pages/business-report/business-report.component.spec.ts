import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BusinessReportComponent } from './business-report.component';

describe('BusinessReportComponent (placeholder)', () => {
  it('has a labelled heading and links back to the listing', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessReportComponent, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ slug: 'v', reference: 'r1' }),
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(BusinessReportComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain(
      'Report or correct this listing'
    );
    expect(el.querySelector('a')?.getAttribute('href')).toBe(
      '/city/v/businesses/r1'
    );
  });
});
