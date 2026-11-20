import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PROFILE } from '../profile.data';
import { SERVICE_ENTRIES } from '../services.data';
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

  it('states the client offer and ties it to the case studies', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain(
      'Bring me in to build it, fix it, or get it shipping again'
    );
    expect(element.textContent).toContain(
      'The case studies above are the same shape'
    );
    expect(element.textContent).toContain('South Georgia');
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

  it('closes with one clear next step and the public email', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('How it starts');
    expect(
      element.querySelector<HTMLAnchorElement>('a[href="#contact"]')
    ).not.toBeNull();
    expect(
      element.querySelector<HTMLAnchorElement>(
        `a[href="mailto:${PROFILE.links.email}"]`
      )
    ).not.toBeNull();
  });
});
