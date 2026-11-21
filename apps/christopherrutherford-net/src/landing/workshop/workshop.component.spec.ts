import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { DEFAULT_APP_REGISTRY } from '@optimistic-tanuki/app-registry-backend';
import { WorkshopComponent } from './workshop.component';

describe('WorkshopComponent', () => {
  let fixture: ComponentFixture<WorkshopComponent>;
  let el: HTMLElement;

  function details(id: string): HTMLDetailsElement {
    return el.querySelector(`details#${id}`) as HTMLDetailsElement;
  }

  beforeEach(async () => {
    window.location.hash = '';
    await TestBed.configureTestingModule({
      imports: [WorkshopComponent],
      providers: [
        {
          provide: AppRegistryService,
          useValue: {
            getAllApps: jest
              .fn()
              .mockReturnValue(of(DEFAULT_APP_REGISTRY.apps)),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WorkshopComponent);
    el = fixture.nativeElement as HTMLElement;
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('wraps the systems lab and catalog in closed details with summaries', () => {
    fixture.detectChanges();

    expect(el.textContent).toContain('More from the workshop');
    expect(details('systems-lab').open).toBe(false);
    expect(details('platform').open).toBe(false);
    expect(
      details('systems-lab').querySelector('summary')?.textContent
    ).toContain('Systems Lab: how the platform fits together');
    expect(details('platform').querySelector('summary')?.textContent).toContain(
      'Platform application catalog'
    );
  });

  it('opens the matching details when the page loads with a hash', () => {
    window.location.hash = '#platform';
    fixture.detectChanges();

    expect(details('platform').open).toBe(true);
    expect(details('systems-lab').open).toBe(false);
  });

  it('opens the matching details on hashchange', () => {
    fixture.detectChanges();
    window.location.hash = '#systems-lab';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(details('systems-lab').open).toBe(true);
  });
});
