import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { PersonalitySceneComponent } from './personality-scene.component';

type Scenes = { id: string; motion?: { scenes?: string[] } };

describe('PersonalitySceneComponent', () => {
  let personality$: BehaviorSubject<Scenes | undefined>;
  let fixture: ComponentFixture<PersonalitySceneComponent>;

  beforeEach(async () => {
    personality$ = new BehaviorSubject<Scenes | undefined>({
      id: 'risograph',
      motion: { scenes: ['halftone-tide'] },
    });
    await TestBed.configureTestingModule({
      imports: [PersonalitySceneComponent],
      providers: [{ provide: ThemeService, useValue: { personality$ } }],
    }).compileComponents();
    fixture = TestBed.createComponent(PersonalitySceneComponent);
    fixture.detectChanges();
  });

  const host = () => fixture.nativeElement as HTMLElement;

  it("renders the personality's most fitting scene", () => {
    expect(host().querySelector('otui-halftone-tide')).toBeTruthy();
    expect(host().getAttribute('data-scene')).toBe('halftone-tide');
  });

  it('switches scene when the personality changes', () => {
    personality$.next({
      id: 'observatory',
      motion: { scenes: ['star-atlas', 'topographic-drift'] },
    });
    fixture.detectChanges();
    expect(host().querySelector('otui-star-atlas')).toBeTruthy();
    expect(host().querySelector('otui-halftone-tide')).toBeNull();
  });

  it('honours `prefer` for a later scene in the list', () => {
    personality$.next({
      id: 'observatory',
      motion: { scenes: ['star-atlas', 'topographic-drift'] },
    });
    fixture.componentRef.setInput('prefer', 1);
    fixture.detectChanges();
    expect(host().querySelector('otui-topographic-drift')).toBeTruthy();
  });

  it('renders nothing for a personality that lists no scenes', () => {
    personality$.next({ id: 'foundation', motion: { scenes: [] } });
    fixture.detectChanges();
    expect(host().children.length).toBe(0);
  });

  it('uses the fallback scene when the personality says nothing', () => {
    personality$.next({ id: 'legacy' });
    fixture.componentRef.setInput('fallbackScene', 'glass-fog');
    fixture.detectChanges();
    expect(host().querySelector('otui-glass-fog')).toBeTruthy();
  });

  it('passes reduced motion through to the scene', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();
    expect(
      host().querySelector('.halftone-tide')?.classList.contains('is-fallback')
    ).toBe(true);
  });

  it('is decorative', () => {
    expect(host().getAttribute('aria-hidden')).toBe('true');
  });
});
