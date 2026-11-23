import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { CommunityService } from '../services/community.service';
import { TownContextService } from '../services/town-context.service';
import { TownSwitcherComponent } from './town-switcher.component';

describe('TownSwitcherComponent', () => {
  const stub = {
    getCities: jest.fn(),
    getCommunities: jest.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    stub.getCities.mockReturnValue(
      of([
        { id: 'a', name: 'Aspen' },
        { id: 'b', name: 'Bayside' },
      ])
    );
    stub.getCommunities.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      imports: [TownSwitcherComponent],
      providers: [
        provideRouter([]),
        { provide: CommunityService, useValue: stub },
      ],
    });
  });

  const create = () => {
    const fixture = TestBed.createComponent(TownSwitcherComponent);
    fixture.detectChanges();
    return fixture;
  };

  const select = (fixture: ReturnType<typeof create>): HTMLSelectElement =>
    fixture.debugElement.query(By.css('select')).nativeElement;

  it('is a labelled select listing the towns', () => {
    const fixture = create();
    const el = select(fixture);
    expect(el.getAttribute('aria-label')).toBe('Town');
    expect(fixture.nativeElement.querySelector('label')?.textContent).toContain(
      'Town'
    );
    expect(Array.from(el.options).map((o) => o.textContent?.trim())).toEqual([
      'No town selected',
      'Aspen',
      'Bayside',
    ]);
  });

  it('sets the town context when a town is chosen', () => {
    const fixture = create();
    const el = select(fixture);
    el.value = 'b';
    el.dispatchEvent(new Event('change'));
    expect(TestBed.inject(TownContextService).selected()?.id).toBe('b');
  });

  it('moves to the same tab under the new town', () => {
    const fixture = create();
    const router = TestBed.inject(Router);
    jest
      .spyOn(router, 'url', 'get')
      .mockReturnValue('/dashboard/towns/a/boundary-review');
    const navigate = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);
    fixture.componentInstance.choose('b');
    expect(navigate).toHaveBeenCalledWith('/dashboard/towns/b/boundary-review');
  });

  it('only sets the context off a town page', () => {
    const fixture = create();
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'url', 'get').mockReturnValue('/dashboard/users');
    const navigate = jest.spyOn(router, 'navigateByUrl');
    fixture.componentInstance.choose('b');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('offers a retry when towns are unavailable', () => {
    stub.getCities.mockReturnValue(throwError(() => new Error('x')));
    stub.getCommunities.mockReturnValue(throwError(() => new Error('x')));
    const fixture = create();
    expect(fixture.debugElement.query(By.css('.retry'))).toBeTruthy();
  });
});
