import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  AuroraRibbonComponent,
  GlassFogComponent,
  MurmurationSceneComponent,
  ParticleVeilComponent,
  ParallaxGridWarpComponent,
  PulseRingsComponent,
  ShimmerBeamComponent,
  SignalMeshComponent,
  TopographicDriftComponent,
} from '@optimistic-tanuki/motion-ui';
import {
  PageShellComponent,
  ElementCardComponent,
  IndexChipComponent,
  PlaygroundElement,
  ElementConfig,
} from '../../shared';

@Component({
  selector: 'pg-motion-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    AuroraRibbonComponent,
    GlassFogComponent,
    MurmurationSceneComponent,
    ParticleVeilComponent,
    ParallaxGridWarpComponent,
    PulseRingsComponent,
    ShimmerBeamComponent,
    SignalMeshComponent,
    TopographicDriftComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/motion-ui"
      title="Motion UI"
      description="Ambient backgrounds and decorative motion primitives for hero sections, editorial layouts, and atmospheric surfaces."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card
        [element]="el"
        [config]="configs[el.id]"
        (configChange)="configs[el.id] = $event"
        (reset)="resetConfig(el.id)"
      >
        @switch (el.id) { @case ('aurora') {
        <otui-aurora-ribbon
          [density]="$any(configs['aurora']['density'])"
          [speed]="$any(configs['aurora']['speed'])"
          [intensity]="$any(configs['aurora']['intensity'])"
          [height]="$any(configs['aurora']['height'])"
          [reducedMotion]="$any(configs['aurora']['reducedMotion'])"
        />
        } @case ('signal-mesh') {
        <otui-signal-mesh
          [height]="$any(configs['signal-mesh']['height'])"
          [density]="$any(configs['signal-mesh']['density'])"
          [speed]="$any(configs['signal-mesh']['speed'])"
          [intensity]="$any(configs['signal-mesh']['intensity'])"
          [reducedMotion]="$any(configs['signal-mesh']['reducedMotion'])"
        />
        } @case ('murmuration') {
        <otui-murmuration-scene
          [count]="$any(configs['murmuration']['count'])"
          [speed]="$any(configs['murmuration']['speed'])"
          [height]="$any(configs['murmuration']['height'])"
          [reducedMotion]="$any(configs['murmuration']['reducedMotion'])"
        />
        } @case ('particle') {
        <otui-particle-veil
          [height]="$any(configs['particle']['height'])"
          [density]="$any(configs['particle']['density'])"
          [speed]="$any(configs['particle']['speed'])"
          [intensity]="$any(configs['particle']['intensity'])"
          [reducedMotion]="$any(configs['particle']['reducedMotion'])"
        />
        } @case ('topographic-drift') {
        <otui-topographic-drift
          [height]="$any(configs['topographic-drift']['height'])"
          [density]="$any(configs['topographic-drift']['density'])"
          [speed]="$any(configs['topographic-drift']['speed'])"
          [intensity]="$any(configs['topographic-drift']['intensity'])"
          [reducedMotion]="$any(configs['topographic-drift']['reducedMotion'])"
        />
        } @case ('pulse') {
        <otui-pulse-rings
          [height]="$any(configs['pulse']['height'])"
          [ringCount]="$any(configs['pulse']['ringCount'])"
          [speed]="$any(configs['pulse']['speed'])"
          [intensity]="$any(configs['pulse']['intensity'])"
          [reducedMotion]="$any(configs['pulse']['reducedMotion'])"
        />
        } @case ('beam') {
        <otui-shimmer-beam
          [height]="$any(configs['beam']['height'])"
          [direction]="$any(configs['beam']['direction'])"
          [speed]="$any(configs['beam']['speed'])"
          [intensity]="$any(configs['beam']['intensity'])"
          [reducedMotion]="$any(configs['beam']['reducedMotion'])"
        />
        } @case ('glass-fog') {
        <otui-glass-fog
          [height]="$any(configs['glass-fog']['height'])"
          [density]="$any(configs['glass-fog']['density'])"
          [speed]="$any(configs['glass-fog']['speed'])"
          [intensity]="$any(configs['glass-fog']['intensity'])"
          [reducedMotion]="$any(configs['glass-fog']['reducedMotion'])"
        />
        } @case ('parallax-grid-warp') {
        <otui-parallax-grid-warp
          [height]="$any(configs['parallax-grid-warp']['height'])"
          [density]="$any(configs['parallax-grid-warp']['density'])"
          [speed]="$any(configs['parallax-grid-warp']['speed'])"
          [intensity]="$any(configs['parallax-grid-warp']['intensity'])"
          [reducedMotion]="
            $any(configs['parallax-grid-warp']['reducedMotion'])
          "
        />
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotionUiPageComponent {
  readonly importSnippet = `import { AuroraRibbonComponent, GlassFogComponent, MurmurationSceneComponent, ... } from '@optimistic-tanuki/motion-ui';`;

  configs: Record<string, ElementConfig> = {};

  readonly elements: PlaygroundElement[] = [
    {
      id: 'aurora',
      title: 'Aurora Ribbon',
      headline: 'Layered atmospheric color drift',
      importName: 'AuroraRibbonComponent',
      selector: 'otui-aurora-ribbon',
      summary:
        'Layered blur bands for hero panels, editorial headers, and atmospheric section backgrounds.',
      props: [
        { name: 'height', type: 'string', defaultValue: "'24rem'", description: 'Sets the rendered block height.' },
        { name: 'density', type: 'number', defaultValue: '3', description: 'Controls how many ribbon layers are rendered.', min: 1, max: 6, step: 1 },
        { name: 'speed', type: 'number', defaultValue: '1', description: 'Scales the drift animation rate.', min: 0.1, max: 3, step: 0.1 },
        { name: 'intensity', type: 'number', defaultValue: '0.72', description: 'Raises or lowers overall visual brightness.', min: 0, max: 1, step: 0.01 },
        { name: 'reducedMotion', type: 'boolean', defaultValue: 'false', description: 'Disables animation and shows static state.' },
      ],
    },
    {
      id: 'signal-mesh',
      title: 'Signal Mesh',
      headline: 'Technical lattice with pulsing nodes',
      importName: 'SignalMeshComponent',
      selector: 'otui-signal-mesh',
      summary: 'A network grid with glowing junctions for systems dashboards.',
      props: [
        { name: 'height', type: 'string', defaultValue: "'24rem'", description: 'Sets the rendered block height.' },
        { name: 'density', type: 'number', defaultValue: '5', description: 'Controls grid columns and junctions.', min: 3, max: 7, step: 1 },
        { name: 'speed', type: 'number', defaultValue: '1', description: 'Scales node pulse cadence.', min: 0.1, max: 3, step: 0.1 },
        { name: 'intensity', type: 'number', defaultValue: '0.68', description: 'Adjusts line glow and node bloom.', min: 0, max: 1, step: 0.01 },
        { name: 'reducedMotion', type: 'boolean', defaultValue: 'false', description: 'Freezes the junction pulses.' },
      ],
    },
    {
      id: 'murmuration',
      title: 'Murmuration Scene',
      headline: 'WebGL flocking surface',
      importName: 'MurmurationSceneComponent',
      selector: 'otui-murmuration-scene',
      summary: 'Three.js-driven flocking accent for hero scenes.',
      props: [
        { name: 'count', type: 'number', defaultValue: '48', description: 'Particle count for the flock.', min: 10, max: 100, step: 1 },
        { name: 'speed', type: 'number', defaultValue: '0.35', description: 'Controls flock turn and orbit velocity.', min: 0.05, max: 1, step: 0.05 },
        { name: 'height', type: 'string', defaultValue: "'24rem'", description: 'Sets the scene container height.' },
        { name: 'reducedMotion', type: 'boolean', defaultValue: 'false', description: 'Disables WebGL animation.' },
      ],
    },
    {
      id: 'particle',
      title: 'Particle Veil',
      headline: 'Soft field for depth and texture',
      importName: 'ParticleVeilComponent',
      selector: 'otui-particle-veil',
      summary: 'Soft drifting field for background texture.',
      props: [
        { name: 'height', type: 'string', defaultValue: "'24rem'", description: 'Sets the rendered block height.' },
        { name: 'density', type: 'number', defaultValue: '24', description: 'Controls the number of particles.', min: 6, max: 48, step: 1 },
        { name: 'speed', type: 'number', defaultValue: '1', description: 'Scales particle drift duration.', min: 0.2, max: 3, step: 0.1 },
        { name: 'intensity', type: 'number', defaultValue: '0.6', description: 'Changes glow and particle presence.', min: 0, max: 1, step: 0.01 },
        { name: 'reducedMotion', type: 'boolean', defaultValue: 'false', description: 'Freezes the veil.' },
      ],
    },
    {
      id: 'topographic-drift',
      title: 'Topographic Drift',
      headline: 'Contour bands with slow editorial motion',
      importName: 'TopographicDriftComponent',
      selector: 'otui-topographic-drift',
      summary: 'Contour-like line bands for editorial layouts.',
      props: [
        { name: 'height', type: 'string', defaultValue: "'24rem'", description: 'Sets the rendered block height.' },
        { name: 'density', type: 'number', defaultValue: '6', description: 'Controls how many contour bands are rendered.', min: 4, max: 10, step: 1 },
        { name: 'speed', type: 'number', defaultValue: '1', description: 'Scales drift phase timing.', min: 0.25, max: 3, step: 0.1 },
        { name: 'intensity', type: 'number', defaultValue: '0.64', description: 'Changes line prominence.', min: 0, max: 1, step: 0.01 },
        { name: 'reducedMotion', type: 'boolean', defaultValue: 'false', description: 'Stops the contour drift.' },
      ],
    },
    {
      id: 'pulse',
      title: 'Pulse Rings',
      headline: 'Beacon-like focal emphasis',
      importName: 'PulseRingsComponent',
      selector: 'otui-pulse-rings',
      summary: 'Concentric signal rings for focal callouts.',
      props: [
        { name: 'height', type: 'string', defaultValue: "'20rem'", description: 'Sets the rendered block height.' },
        { name: 'ringCount', type: 'number', defaultValue: '4', description: 'Sets how many rings are shown.', min: 2, max: 8, step: 1 },
        { name: 'speed', type: 'number', defaultValue: '1', description: 'Scales pulse propagation speed.', min: 0.1, max: 3, step: 0.1 },
        { name: 'intensity', type: 'number', defaultValue: '0.7', description: 'Controls ring visibility.', min: 0, max: 1, step: 0.01 },
        { name: 'reducedMotion', type: 'boolean', defaultValue: 'false', description: 'Removes ring animation.' },
      ],
    },
    {
      id: 'beam',
      title: 'Shimmer Beam',
      headline: 'Directional luminous sweep',
      importName: 'ShimmerBeamComponent',
      selector: 'otui-shimmer-beam',
      summary: 'Directional sweep accent for section caps.',
      props: [
        { name: 'height', type: 'string', defaultValue: "'18rem'", description: 'Sets the rendered block height.' },
        { name: 'direction', type: "'diagonal' | 'horizontal'", defaultValue: "'diagonal'", description: 'Selects the sweep axis.', options: ['diagonal', 'horizontal'] },
        { name: 'speed', type: 'number', defaultValue: '1', description: 'Scales beam travel duration.', min: 0.1, max: 3, step: 0.1 },
        { name: 'intensity', type: 'number', defaultValue: '0.65', description: 'Changes beam brightness.', min: 0, max: 1, step: 0.01 },
        { name: 'reducedMotion', type: 'boolean', defaultValue: 'false', description: 'Locks the beam in static state.' },
      ],
    },
    {
      id: 'glass-fog',
      title: 'Glass Fog',
      headline: 'Refracted haze for premium surfaces',
      importName: 'GlassFogComponent',
      selector: 'otui-glass-fog',
      summary: 'Layered atmospheric fog for modal shells.',
      props: [
        { name: 'height', type: 'string', defaultValue: "'24rem'", description: 'Sets the rendered block height.' },
        { name: 'density', type: 'number', defaultValue: '4', description: 'Controls how many haze blobs.', min: 3, max: 7, step: 1 },
        { name: 'speed', type: 'number', defaultValue: '1', description: 'Scales drift speed.', min: 0.25, max: 3, step: 0.1 },
        { name: 'intensity', type: 'number', defaultValue: '0.66', description: 'Haze brightness and refraction weight.', min: 0, max: 1, step: 0.01 },
        { name: 'reducedMotion', type: 'boolean', defaultValue: 'false', description: 'Disables the floating haze.' },
      ],
    },
    {
      id: 'parallax-grid-warp',
      title: 'Parallax Grid Warp',
      headline: 'Perspective grid with a focal well',
      importName: 'ParallaxGridWarpComponent',
      selector: 'otui-parallax-grid-warp',
      summary: 'Perspective grid distortion for feature explainers.',
      props: [
        { name: 'height', type: 'string', defaultValue: "'24rem'", description: 'Sets the rendered block height.' },
        { name: 'density', type: 'number', defaultValue: '6', description: 'Controls animated perspective beams.', min: 4, max: 9, step: 1 },
        { name: 'speed', type: 'number', defaultValue: '1', description: 'Scales grid-beam drift rate.', min: 0.25, max: 3, step: 0.1 },
        { name: 'intensity', type: 'number', defaultValue: '0.7', description: 'Beam contrast and focal glow.', min: 0, max: 1, step: 0.01 },
        { name: 'reducedMotion', type: 'boolean', defaultValue: 'false', description: 'Stops the beam drift.' },
      ],
    },
  ];

  constructor() {
    this.initConfigs();
  }

  private initConfigs(): void {
    for (const el of this.elements) {
      const cfg: ElementConfig = {};
      for (const prop of el.props) {
        cfg[prop.name] = this.parseDefault(prop);
      }
      this.configs[el.id] = cfg;
    }
  }

  private parseDefault(prop: { type: string; defaultValue: string }): number | string | boolean {
    const v = prop.defaultValue;
    if (prop.type === 'boolean') return v === 'true';
    if (prop.type === 'number') return parseFloat(v) || 0;
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
    return v;
  }

  resetConfig(id: string): void {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    const cfg: ElementConfig = {};
    for (const prop of el.props) {
      cfg[prop.name] = this.parseDefault(prop);
    }
    this.configs[id] = cfg;
  }
}
