import type { Type } from '@angular/core';
import { AuroraRibbonComponent } from './aurora-ribbon.component';
import { GlassFogComponent } from './glass-fog.component';
import { MurmurationSceneComponent } from './murmuration-scene.component';
import { ParallaxGridWarpComponent } from './parallax-grid-warp.component';
import { ParticleVeilComponent } from './particle-veil.component';
import { PulseRingsComponent } from './pulse-rings.component';
import { ShimmerBeamComponent } from './shimmer-beam.component';
import { SignalMeshComponent } from './signal-mesh.component';
import { TopographicDriftComponent } from './topographic-drift.component';
import { HalftoneTideComponent } from './halftone-tide.component';
import { StarAtlasComponent } from './star-atlas.component';
import { LedgerTickerComponent } from './ledger-ticker.component';
import { GridShiftComponent } from './grid-shift.component';
import { CanopyDappleComponent } from './canopy-dapple.component';
import { ClayBlobsComponent } from './clay-blobs.component';
import { NeonCircuitComponent } from './neon-circuit.component';
import { BlueprintScanComponent } from './blueprint-scan.component';
import { FlockFieldComponent } from './flock-field.component';

/** Inputs every scene understands (mapped per scene where names differ). */
export interface SceneInputs {
  height: string;
  /** 1–10; mapped to count / ringCount where a scene uses those. */
  density: number;
  speed: number;
  intensity: number;
  reducedMotion: boolean;
}

export interface SceneDefinition {
  component: Type<unknown>;
  /** Map the common inputs onto this scene's own input names. */
  inputs: (common: SceneInputs) => Record<string, unknown>;
}

const standard = (common: SceneInputs) => ({ ...common });
const withoutDensity = ({ density: _density, ...rest }: SceneInputs) => rest;

/**
 * Every motion-ui scene by kind. Keys match `SceneKind` in the personality
 * contract (`motion.scenes`), so a personality can name the scenes that suit
 * it without depending on this library.
 */
export const SCENE_REGISTRY = {
  'aurora-ribbon': { component: AuroraRibbonComponent, inputs: standard },
  'glass-fog': { component: GlassFogComponent, inputs: standard },
  'murmuration-scene': {
    component: MurmurationSceneComponent,
    inputs: ({ height, density, speed, reducedMotion }) => ({
      height,
      count: 30 + density * 12,
      speed: speed * 0.5,
      reducedMotion,
    }),
  },
  'parallax-grid-warp': {
    component: ParallaxGridWarpComponent,
    inputs: standard,
  },
  'particle-veil': { component: ParticleVeilComponent, inputs: standard },
  'pulse-rings': {
    component: PulseRingsComponent,
    inputs: ({ density, ...rest }) => ({
      ...rest,
      ringCount: Math.round(2 + density * 0.6),
    }),
  },
  'shimmer-beam': {
    component: ShimmerBeamComponent,
    inputs: (c) => ({ ...withoutDensity(c), direction: 'diagonal' }),
  },
  'signal-mesh': { component: SignalMeshComponent, inputs: standard },
  'topographic-drift': {
    component: TopographicDriftComponent,
    inputs: standard,
  },
  'halftone-tide': { component: HalftoneTideComponent, inputs: standard },
  'star-atlas': { component: StarAtlasComponent, inputs: standard },
  'ledger-ticker': { component: LedgerTickerComponent, inputs: standard },
  'grid-shift': { component: GridShiftComponent, inputs: standard },
  'canopy-dapple': { component: CanopyDappleComponent, inputs: standard },
  'clay-blobs': { component: ClayBlobsComponent, inputs: standard },
  'neon-circuit': { component: NeonCircuitComponent, inputs: standard },
  'blueprint-scan': { component: BlueprintScanComponent, inputs: standard },
  'flock-field': { component: FlockFieldComponent, inputs: standard },
} satisfies Record<string, SceneDefinition>;

export type SceneKind = keyof typeof SCENE_REGISTRY;

export function isSceneKind(value: string): value is SceneKind {
  return value in SCENE_REGISTRY;
}
