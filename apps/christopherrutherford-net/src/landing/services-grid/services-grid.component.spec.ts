import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SERVICE_ENTRIES, WORK_MODES } from '../services.data';
import { ServicesGridComponent } from './services-grid.component';

describe('ServicesGridComponent', () => {
  let component: ServicesGridComponent;
  let fixture: ComponentFixture<ServicesGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicesGridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ServicesGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('presents ways to work together with consulting as one of them', () => {
    const element = fixture.nativeElement as HTMLElement;
    const modes = Array.from(element.querySelectorAll('.mode h3')).map(
      (heading) => heading.textContent?.trim()
    );

    expect(element.textContent).toContain('Ways to work together');
    expect(element.textContent).toContain(
      'Available for full-time engineering roles, conventional contracts, and selected independent engagements.'
    );
    expect(modes).toEqual(WORK_MODES.map((mode) => mode.title));
    expect(modes.slice(0, 2)).toEqual([
      'Full-time employment',
      'Contract engineering',
    ]);
    expect(element.textContent).toContain(
      'Independent engineering and technical consulting'
    );
    expect(element.textContent).toContain('South Georgia and remote');
    expect(
      element.querySelector(
        'a[href="https://hopefulaspirationsindustries.com"]'
      )
    ).not.toBeNull();
  });

  it('renders one card per offer with concrete deliverables', () => {
    const element = fixture.nativeElement as HTMLElement;
    const cards = element.querySelectorAll('.service-card');

    expect(cards).toHaveLength(SERVICE_ENTRIES.length);
    for (const service of SERVICE_ENTRIES) {
      expect(element.textContent).toContain(service.title);
      for (const item of service.deliverables) {
        expect(element.textContent).toContain(item);
      }
    }
    expect(element.querySelectorAll('.service-card img')).toHaveLength(0);
  });

  it('closes with one clear next step', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('a[href="#contact"]')).toHaveLength(1);
  });
});
