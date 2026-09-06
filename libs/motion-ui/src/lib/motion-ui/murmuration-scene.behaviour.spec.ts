import { ComponentFixture, TestBed } from '@angular/core/testing';

/**
 * jsdom has no WebGL, so the component's own guard sends every render path
 * straight to fallback mode and the flocking simulation never runs. To reach
 * it, three.js is replaced with a recording stub and WebGLRenderingContext is
 * declared, so `initializeScene` and `animate` execute for real.
 *
 * The stub is deliberately thin — it records what the component asks for and
 * keeps `MathUtils.clamp` faithful, because the clamp is the component's own
 * behaviour under test, not the library's. Assertions are about the
 * simulation's arithmetic: that boids move, that velocity is bounded, and that
 * they turn back at the edges of the box.
 */

class FakeBufferAttribute {
  needsUpdate = false;
  constructor(public array: Float32Array, public itemSize: number) {}
}

class FakeBufferGeometry {
  attributes: Record<string, FakeBufferAttribute> = {};
  dispose = jest.fn();
  setAttribute(name: string, attribute: FakeBufferAttribute) {
    this.attributes[name] = attribute;
  }
  clone() {
    const cloned = new FakeBufferGeometry();
    cloned.attributes = this.attributes;
    return cloned;
  }
}

const rendered: Array<[unknown, unknown]> = [];

jest.mock('three', () => {
  class WebGLRenderer {
    static instances: WebGLRenderer[] = [];
    setPixelRatio = jest.fn();
    setSize = jest.fn();
    dispose = jest.fn();
    render = jest.fn((scene: unknown, camera: unknown) => {
      rendered.push([scene, camera]);
    });
    constructor(public options: Record<string, unknown>) {
      WebGLRenderer.instances.push(this);
    }
  }

  class Scene {
    children: unknown[] = [];
    add(child: unknown) {
      this.children.push(child);
    }
  }

  class PerspectiveCamera {
    aspect = 1;
    position = { set: jest.fn() };
    updateProjectionMatrix = jest.fn();
    constructor(
      public fov: number,
      aspect: number,
      public near: number,
      public far: number
    ) {
      this.aspect = aspect;
    }
  }

  class PointsMaterial {
    dispose = jest.fn();
    constructor(public options: Record<string, unknown>) {}
  }

  class Points {
    rotation = { z: 0 };
    constructor(
      public geometry: FakeBufferGeometry,
      public material: PointsMaterial
    ) {}
  }

  class Color {
    constructor(public value: string) {}
  }

  return {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    PointsMaterial,
    Points,
    Color,
    BufferGeometry: FakeBufferGeometry,
    BufferAttribute: FakeBufferAttribute,
    AdditiveBlending: 'additive',
    // Kept faithful: the component relies on this to bound velocity.
    MathUtils: {
      clamp: (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value)),
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { MurmurationSceneComponent } from './murmuration-scene.component';

interface SceneInternals {
  positions?: Float32Array;
  velocities?: Float32Array;
  frameId?: number;
  renderer?: { dispose: jest.Mock; setSize: jest.Mock };
  points?: {
    geometry: FakeBufferGeometry;
    material: { dispose: jest.Mock };
    rotation: { z: number };
  };
  resizeObserver?: { disconnect: jest.Mock };
  animate(): void;
  handleResize(): void;
  createInitialPositions(count: number): Float32Array;
  createInitialVelocities(count: number): Float32Array;
  readPalette(): { primary: string; secondary: string };
}

describe('MurmurationSceneComponent simulation', () => {
  let fixture: ComponentFixture<MurmurationSceneComponent>;
  let component: MurmurationSceneComponent;
  let internals: SceneInternals;
  let frameCallbacks: FrameRequestCallback[];
  let observerCallbacks: (() => void)[];

  const originalRaf = globalThis.requestAnimationFrame;
  const originalCaf = globalThis.cancelAnimationFrame;
  const originalObserver = (
    globalThis as unknown as { ResizeObserver?: unknown }
  ).ResizeObserver;

  beforeEach(async () => {
    rendered.length = 0;
    frameCallbacks = [];
    observerCallbacks = [];

    // The component's guard checks for this symbol before touching WebGL.
    (
      globalThis as unknown as { WebGLRenderingContext?: unknown }
    ).WebGLRenderingContext = function WebGLRenderingContext() {
      /* marker only */
    };

    // Frames are captured rather than run, so `animate` executes exactly once
    // per explicit call instead of scheduling itself forever.
    globalThis.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    }) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = jest.fn();

    (
      globalThis as unknown as { ResizeObserver: unknown }
    ).ResizeObserver = class {
      disconnect = jest.fn();
      observe = jest.fn();
      constructor(cb: () => void) {
        observerCallbacks.push(cb);
      }
    };

    await TestBed.configureTestingModule({
      imports: [MurmurationSceneComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MurmurationSceneComponent);
    component = fixture.componentInstance;
    internals = component as unknown as SceneInternals;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
    (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver =
      originalObserver;
    delete (globalThis as unknown as { WebGLRenderingContext?: unknown })
      .WebGLRenderingContext;
    jest.restoreAllMocks();
  });

  describe('seeding', () => {
    it('lays out three coordinates per boid inside the starting box', () => {
      const positions = internals.createInitialPositions(10);

      expect(positions).toHaveLength(30);
      for (let index = 0; index < 10; index++) {
        const offset = index * 3;
        expect(Math.abs(positions[offset])).toBeLessThanOrEqual(6.5);
        expect(Math.abs(positions[offset + 1])).toBeLessThanOrEqual(3.6);
        expect(Math.abs(positions[offset + 2])).toBeLessThanOrEqual(1.4);
      }
    });

    it('gives every boid a bounded starting velocity and no depth drift', () => {
      const velocities = internals.createInitialVelocities(10);

      expect(velocities).toHaveLength(30);
      for (let index = 0; index < 10; index++) {
        const offset = index * 3;
        expect(Math.abs(velocities[offset])).toBeLessThanOrEqual(0.01);
        expect(Math.abs(velocities[offset + 1])).toBeLessThanOrEqual(0.007);
        // The flock stays on a plane; depth is decorative only.
        expect(velocities[offset + 2]).toBe(0);
      }
    });
  });

  describe('palette', () => {
    it('falls back to the built-in colours when the theme sets none', () => {
      expect(internals.readPalette()).toEqual({
        primary: '#2563eb',
        secondary: '#14b8a6',
      });
    });

    it('prefers the theme variables when they are set', () => {
      document.documentElement.style.setProperty('--primary', '#ff0000');
      document.documentElement.style.setProperty('--secondary', '#00ff00');

      expect(internals.readPalette()).toEqual({
        primary: '#ff0000',
        secondary: '#00ff00',
      });

      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--secondary');
    });
  });

  describe('once the scene is running', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('builds the renderer, both swarms and a first frame', () => {
      expect(internals.renderer).toBeDefined();
      expect(internals.positions).toHaveLength(component.count * 3);
      expect(internals.velocities).toHaveLength(component.count * 3);
      // The primary flock plus the finer secondary swarm behind it.
      expect(rendered.length).toBeGreaterThan(0);
    });

    it('moves the flock and marks the buffer for upload', () => {
      const before = Float32Array.from(internals.positions as Float32Array);

      internals.animate();

      expect(Array.from(internals.positions as Float32Array)).not.toEqual(
        Array.from(before)
      );
      expect(
        internals.points?.geometry.attributes['position'].needsUpdate
      ).toBe(true);
    });

    it('rotates the flock in proportion to speed', () => {
      component.speed = 2;
      const before = internals.points?.rotation.z ?? 0;

      internals.animate();

      expect(internals.points?.rotation.z).toBeCloseTo(before + 0.0015 * 2);
    });

    it('keeps velocity inside the speed budget', () => {
      component.speed = 0.5;
      const budget = Math.max(component.speed, 0.05) * 0.02;
      // Start well outside the budget so the clamp has to pull it back.
      (internals.velocities as Float32Array).fill(5);

      internals.animate();

      const velocities = internals.velocities as Float32Array;
      for (let index = 0; index < component.count; index++) {
        const offset = index * 3;
        expect(Math.abs(velocities[offset])).toBeLessThanOrEqual(budget);
        expect(Math.abs(velocities[offset + 1])).toBeLessThanOrEqual(budget);
      }
    });

    it('applies a floor to the speed so a stopped flock still drifts', () => {
      component.speed = 0;
      (internals.velocities as Float32Array).fill(5);

      internals.animate();

      // Math.max(speed, 0.05) keeps the budget non-zero. Compared loosely
      // because the value round-trips through a Float32Array, which cannot
      // represent 0.001 exactly.
      const velocities = internals.velocities as Float32Array;
      expect(Math.abs(velocities[0])).toBeGreaterThan(0);
      expect(Math.abs(velocities[0])).toBeCloseTo(0.05 * 0.02, 6);
    });

    it.each([
      ['horizontally past 6.8', 0, 7.5],
      ['vertically past 4.1', 1, 4.5],
    ])('turns a boid back when it strays %s', (_case, axis, beyond) => {
      const positions = internals.positions as Float32Array;
      const velocities = internals.velocities as Float32Array;
      positions[axis] = beyond;
      velocities[axis] = 0.01;

      internals.animate();

      // The component reflects velocity rather than clamping position.
      expect(velocities[axis]).toBeLessThan(0);
    });

    it('schedules the next frame', () => {
      frameCallbacks.length = 0;

      internals.animate();

      expect(frameCallbacks).toHaveLength(1);
    });

    it('resizes to the host with a floor on both dimensions', () => {
      const setSize = internals.renderer?.setSize as jest.Mock;
      setSize.mockClear();

      internals.handleResize();

      // jsdom reports zero-sized elements, so the floors are what land.
      expect(setSize).toHaveBeenCalledWith(320, 240, false);
    });

    it('re-measures when the host resizes', () => {
      const setSize = internals.renderer?.setSize as jest.Mock;
      setSize.mockClear();

      observerCallbacks.forEach((cb) => cb());

      expect(setSize).toHaveBeenCalled();
    });

    it('tears the scene down on destroy', () => {
      const renderer = internals.renderer;
      const points = internals.points;
      const observer = internals.resizeObserver;

      component.ngOnDestroy();

      expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
      expect(observer?.disconnect).toHaveBeenCalled();
      expect(renderer?.dispose).toHaveBeenCalled();
      expect(points?.geometry.dispose).toHaveBeenCalled();
      expect(points?.material.dispose).toHaveBeenCalled();
    });
  });

  describe('fallback', () => {
    it('skips the scene entirely in reduced-motion mode', () => {
      component.reducedMotion = true;

      fixture.detectChanges();

      expect(internals.renderer).toBeUndefined();
    });

    it('falls back when WebGL is unavailable', () => {
      delete (globalThis as unknown as { WebGLRenderingContext?: unknown })
        .WebGLRenderingContext;

      fixture.detectChanges();

      expect(internals.renderer).toBeUndefined();
    });

    it('is safe to destroy before anything was built', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
