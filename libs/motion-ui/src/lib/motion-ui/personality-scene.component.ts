import { NgComponentOutlet, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  SCENE_PERSONALITY,
  type ScenePersonality,
} from './scene-personality.token';
import { SCENE_REGISTRY, isSceneKind, type SceneKind } from './scene-registry';

type SceneAware = ScenePersonality | null | undefined;

/**
 * Renders the motion-ui scene that suits the active personality.
 *
 * Replaces the per-app pattern of hard-coding one scene in the app shell and
 * re-implementing `prefers-reduced-motion` detection:
 *
 *   <otui-personality-scene height="100vh" />
 *
 * - scene: the personality's `motion.scenes[prefer]` (falls back to the first,
 *   or to `fallbackScene`; an empty list renders nothing, e.g. foundation);
 * - reduced motion: follows the OS setting (override with `reducedMotion`);
 * - pauses its scene while offscreen (`.is-offscreen` on the host, read by
 *   the scene contract) — one scene per view is the budget.
 */
@Component({
  selector: 'otui-personality-scene',
  standalone: true,
  imports: [NgComponentOutlet],
  template: `
    @if (definition(); as scene) {
    <ng-container *ngComponentOutlet="scene.component; inputs: sceneInputs()" />
    }
  `,
  styles: [':host { display: block; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.is-offscreen]': 'offscreen()',
    '[attr.data-scene]': 'kind() ?? null',
  },
})
export class PersonalitySceneComponent implements AfterViewInit {
  @Input() set height(value: string) {
    this.heightSignal.set(value);
  }
  @Input() set density(value: number) {
    this.densitySignal.set(value);
  }
  @Input() set speed(value: number) {
    this.speedSignal.set(value);
  }
  @Input() set intensity(value: number) {
    this.intensitySignal.set(value);
  }
  /** Force reduced motion on/off; `undefined` follows the OS setting. */
  @Input() set reducedMotion(value: boolean | undefined) {
    this.reducedOverride.set(value);
  }
  /** Which of the personality's scenes to use (0 = most fitting). */
  @Input() set prefer(value: number) {
    this.preferSignal.set(value);
  }
  /** Used when the personality names no scenes the registry knows. */
  @Input() set fallbackScene(value: SceneKind | null) {
    this.fallbackSignal.set(value);
  }

  private readonly personality$ = inject(SCENE_PERSONALITY, { optional: true });
  private readonly platformId = inject(PLATFORM_ID);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private readonly heightSignal = signal('100vh');
  private readonly densitySignal = signal(5);
  private readonly speedSignal = signal(1);
  private readonly intensitySignal = signal(0.7);
  private readonly reducedOverride = signal<boolean | undefined>(undefined);
  private readonly preferSignal = signal(0);
  private readonly fallbackSignal = signal<SceneKind | null>(null);
  private readonly osReduced = signal(false);
  private readonly personality = signal<SceneAware>(undefined);
  protected readonly offscreen = signal(false);

  protected readonly kind = computed<SceneKind | null>(() => {
    const listed = (this.personality()?.motion?.scenes ?? []).filter(
      isSceneKind
    );
    if (this.personality()?.motion?.scenes && listed.length === 0) return null;
    return listed[this.preferSignal()] ?? listed[0] ?? this.fallbackSignal();
  });

  protected readonly definition = computed(() => {
    const kind = this.kind();
    return kind ? SCENE_REGISTRY[kind] : null;
  });

  protected readonly sceneInputs = computed(() => {
    const scene = this.definition();
    if (!scene) return {};
    return scene.inputs({
      height: this.heightSignal(),
      density: this.densitySignal(),
      speed: this.speedSignal(),
      intensity: this.intensitySignal(),
      reducedMotion: this.reducedOverride() ?? this.osReduced(),
    });
  });

  constructor() {
    this.personality$
      ?.pipe(takeUntilDestroyed())
      .subscribe((personality) => this.personality.set(personality));
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (media) {
      this.osReduced.set(media.matches);
      const onChange = (event: MediaQueryListEvent) =>
        this.osReduced.set(event.matches);
      media.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() =>
        media.removeEventListener('change', onChange)
      );
    }
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(([entry]) =>
        this.offscreen.set(!entry.isIntersecting)
      );
      io.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => io.disconnect());
    }
  }
}
