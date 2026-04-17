import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'otui-murmuration-scene',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './murmuration-scene.component.html',
  styleUrl: './murmuration-scene.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'otui-murmuration-host',
  },
})
export class MurmurationSceneComponent implements AfterViewInit, OnDestroy {
  @Input() count = 48;
  @Input() speed = 0.35;
  @Input() height = '24rem';
  @Input() reducedMotion = false;

  @ViewChild('canvas', { static: true })
  private readonly canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  protected fallbackMode = false;

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private points?: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private positions?: Float32Array;
  private velocities?: Float32Array;
  private frameId?: number;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.canvasRef?.nativeElement) {
      this.fallbackMode = true;
      return;
    }

    if (this.reducedMotion) {
      this.fallbackMode = true;
      return;
    }

    if (typeof WebGLRenderingContext === 'undefined') {
      this.fallbackMode = true;
      return;
    }

    this.zone.runOutsideAngular(() => {
      try {
        this.initializeScene();
      } catch {
        this.fallbackMode = true;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }

    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
    this.points?.geometry.dispose();
    this.points?.material.dispose();
  }

  private initializeScene(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      this.fallbackMode = true;
      return;
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, 12);

    const geometry = new THREE.BufferGeometry();
    this.positions = this.createInitialPositions(this.count);
    this.velocities = this.createInitialVelocities(this.count);

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );

    const palette = this.readPalette();
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(palette.primary),
      size: 0.16,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.scene.add(this.points);

    const secondarySwarm = new THREE.Points(
      geometry.clone(),
      new THREE.PointsMaterial({
        color: new THREE.Color(palette.secondary),
        size: 0.06,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      })
    );
    secondarySwarm.rotation.z = Math.PI / 18;
    this.scene.add(secondarySwarm);

    this.handleResize();
    this.animate();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(canvas.parentElement ?? canvas);
    }
  }

  private animate(): void {
    if (
      !this.positions ||
      !this.velocities ||
      !this.points ||
      !this.renderer ||
      !this.scene ||
      !this.camera
    ) {
      return;
    }

    let centerX = 0;
    let centerY = 0;
    for (let index = 0; index < this.count; index++) {
      const offset = index * 3;
      centerX += this.positions[offset];
      centerY += this.positions[offset + 1];
    }
    centerX /= this.count;
    centerY /= this.count;

    const velocityScale = Math.max(this.speed, 0.05) * 0.02;

    for (let index = 0; index < this.count; index++) {
      const offset = index * 3;
      const x = this.positions[offset];
      const y = this.positions[offset + 1];
      const dx = centerX - x;
      const dy = centerY - y;

      this.velocities[offset] += dx * 0.0006;
      this.velocities[offset + 1] += dy * 0.0004;
      this.velocities[offset] += Math.cos(y + index) * 0.0008;
      this.velocities[offset + 1] += Math.sin(x + index) * 0.0006;

      this.velocities[offset] = THREE.MathUtils.clamp(
        this.velocities[offset],
        -velocityScale,
        velocityScale
      );
      this.velocities[offset + 1] = THREE.MathUtils.clamp(
        this.velocities[offset + 1],
        -velocityScale,
        velocityScale
      );

      this.positions[offset] += this.velocities[offset];
      this.positions[offset + 1] += this.velocities[offset + 1];

      if (Math.abs(this.positions[offset]) > 6.8) {
        this.velocities[offset] *= -1;
      }
      if (Math.abs(this.positions[offset + 1]) > 4.1) {
        this.velocities[offset + 1] *= -1;
      }
    }

    this.points.geometry.attributes['position'].needsUpdate = true;
    this.points.rotation.z += 0.0015 * this.speed;
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(() => this.animate());
  }

  private handleResize(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.renderer || !this.camera) {
      return;
    }

    const host = canvas.parentElement ?? canvas;
    const width = Math.max(host.clientWidth, 320);
    const height = Math.max(host.clientHeight, 240);

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private createInitialPositions(count: number): Float32Array {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      positions[offset] = (Math.random() - 0.5) * 13;
      positions[offset + 1] = (Math.random() - 0.5) * 7.2;
      positions[offset + 2] = (Math.random() - 0.5) * 2.8;
    }
    return positions;
  }

  private createInitialVelocities(count: number): Float32Array {
    const velocities = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      velocities[offset] = (Math.random() - 0.5) * 0.02;
      velocities[offset + 1] = (Math.random() - 0.5) * 0.014;
      velocities[offset + 2] = 0;
    }
    return velocities;
  }

  private readPalette(): { primary: string; secondary: string } {
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      primary: rootStyle.getPropertyValue('--primary').trim() || '#2563eb',
      secondary: rootStyle.getPropertyValue('--secondary').trim() || '#14b8a6',
    };
  }
}
