import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  signal,
  HostListener,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import { PermissionsService } from '../../permissions.service';
import { SignalMeshComponent } from '@optimistic-tanuki/motion-ui';

type ShellNavItem = {
  label: string;
  segment: string;
  permission: string;
  icon: string;
};

@Component({
  selector: 'fc-commander-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterOutlet,
    SignalMeshComponent,
  ],
  template: `
    @if (plan(); as activePlan) {
    <div class="shell-root">
      <!-- ── TOP BAR ─────────────────────────────────────────── -->
      <header class="topbar">
        <div class="topbar-left">
          <span class="brand-mark">FC</span>
          <div class="plan-identity">
            <span class="plan-eyebrow">Active Plan</span>
            <span class="plan-name-short">{{ activePlan.name }}</span>
          </div>
        </div>

        <button
          class="plan-drawer-toggle"
          [class.open]="planDrawerOpen()"
          (click)="togglePlanDrawer()"
          aria-label="Switch plan"
        >
          <span class="toggle-label">Plans</span>
          <span class="toggle-chevron">{{ planDrawerOpen() ? '▲' : '▼' }}</span>
        </button>
      </header>

      <!-- ── PLAN SWITCHER DRAWER ──────────────────────────────── -->
      <div class="plan-drawer" [class.open]="planDrawerOpen()">
        <div class="drawer-inner">
          <span class="drawer-label">Switch Plan</span>
          <div class="plan-list">
            @for (option of plans(); track option.id) {
            <a
              class="plan-pill"
              [routerLink]="['/commander', option.id, 'overview']"
              [class.active]="option.id === activePlan.id"
              (click)="planDrawerOpen.set(false)"
            >
              <span class="plan-pill-dot"></span>
              {{ option.name }}
            </a>
            }
          </div>
        </div>
      </div>
      @if (planDrawerOpen()) {
      <div class="drawer-backdrop" (click)="planDrawerOpen.set(false)"></div>
      }

      <!-- ── HERO ──────────────────────────────────────────────── -->
      <section class="hero-compact">
        <otui-signal-mesh
          class="hero-mesh"
          [height]="'100%'"
          [density]="4"
          [speed]="0.6"
          [intensity]="0.3"
        ></otui-signal-mesh>

        <div class="hero-inner">
          <div class="hero-left">
            <h1 class="hero-title">{{ activePlan.name }}</h1>
            @if (activePlan.description) {
            <p class="hero-desc">{{ activePlan.description }}</p>
            }
          </div>
          <div class="hero-right">
            <span class="status-dot pulse"></span>
            <span class="status-text">Live</span>
            <span class="status-sep">·</span>
            <span class="status-meta">{{ activePlan.defaultWorkspace }}</span>
          </div>
        </div>
      </section>

      <!-- ── SUBNAV ─────────────────────────────────────────────── -->
      <nav class="subnav" role="navigation" aria-label="Commander sections">
        <div class="subnav-track">
          @for (item of visibleNavItems(); track item.segment) {
          <a
            class="nav-item"
            [routerLink]="['/commander', activePlan.id, item.segment]"
            routerLinkActive="active"
          >
            <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </a>
          }
        </div>
      </nav>

      <!-- ── CONTENT ────────────────────────────────────────────── -->
      <main class="shell-content">
        <router-outlet></router-outlet>
      </main>

      <!-- ── MOBILE BOTTOM NAV ─────────────────────────────────── -->
      <nav class="mobile-bottom-nav" aria-label="Mobile navigation">
        @for (item of visibleNavItems(); track item.segment) {
        <a
          class="bottom-nav-item"
          [routerLink]="['/commander', activePlan.id, item.segment]"
          routerLinkActive="active"
        >
          <span class="bottom-nav-icon">{{ item.icon }}</span>
          <span class="bottom-nav-label">{{ item.label }}</span>
        </a>
        }
      </nav>
    </div>

    } @else {

    <!-- ── EMPTY / CREATE PLAN STATE ─────────────────────────────── -->
    <div class="create-shell">
      <div class="create-bg">
        <otui-signal-mesh
          [height]="'100%'"
          [density]="5"
          [speed]="0.5"
          [intensity]="0.3"
        ></otui-signal-mesh>
      </div>

      <div class="create-card">
        <div class="create-header">
          <span class="brand-mark large">FC</span>
          <div>
            <span class="eyebrow">Commander</span>
            <h1 class="create-title">No plan yet</h1>
          </div>
        </div>
        <p class="create-desc">
          Your account and ledger are ready. Create the first plan you want to
          steer from Commander.
        </p>

        <div class="create-form">
          <div class="create-field">
            <label class="field-label" for="plan-name">Plan name</label>
            <input
              id="plan-name"
              class="field-input"
              [(ngModel)]="newPlanName"
              placeholder="Annual household plan"
            />
          </div>
          <div class="create-field">
            <label class="field-label" for="plan-description"
              >What is this plan for?</label
            >
            <textarea
              id="plan-description"
              class="field-textarea"
              [(ngModel)]="newPlanDescription"
              placeholder="Keep monthly obligations funded and track savings goals."
            ></textarea>
          </div>
          <button
            type="button"
            class="create-cta"
            [disabled]="!newPlanName.trim()"
            (click)="createPlan()"
          >
            Create your first plan
            <span class="cta-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
    }
  `,
  styles: [
    `
      /* ─── RESET / ROOT ─────────────────────────────────────── */
      :host {
        display: block;
      }

      /* ─── SHELL ROOT ────────────────────────────────────────── */
      .shell-root {
        display: grid;
        grid-template-rows: auto auto auto auto 1fr;
        grid-template-areas:
          'topbar'
          'hero'
          'subnav'
          'content';
        min-height: 100dvh;
        padding-bottom: 0;
      }

      /* ─── TOP BAR ───────────────────────────────────────────── */
      .topbar {
        grid-area: topbar;
        position: sticky;
        top: 0;
        z-index: var(--z-index-dropdown, 100);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 1.25rem;
        background: color-mix(in srgb, var(--background) 90%, transparent);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid
          color-mix(in srgb, var(--border) 40%, transparent);
        animation: slideDown 0.4s
          var(--fc-transition-easing, cubic-bezier(0.16, 1, 0.3, 1)) both;
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-100%);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .topbar-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .brand-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.2rem;
        height: 2.2rem;
        background: var(--primary);
        color: var(--background);
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        border-radius: 10px;
        flex-shrink: 0;

        &.large {
          width: 3rem;
          height: 3rem;
          font-size: 1rem;
          border-radius: 14px;
        }
      }

      .plan-identity {
        display: grid;
        gap: 0.1rem;
      }

      .plan-eyebrow {
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-weight: 600;
        color: var(--muted);
      }

      .plan-name-short {
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--foreground);
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }

      .plan-drawer-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: color-mix(in srgb, var(--surface) 90%, transparent);
        border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        border-radius: var(--fc-button-radius, 9999px);
        color: var(--foreground);
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );
        font-family: inherit;

        &:hover,
        &.open {
          background: color-mix(in srgb, var(--primary) 12%, var(--surface));
          border-color: var(--primary);
          color: var(--primary);
        }
      }

      .toggle-chevron {
        font-size: 0.6rem;
        opacity: 0.7;
      }

      /* ─── PLAN DRAWER ───────────────────────────────────────── */
      .plan-drawer {
        position: fixed;
        top: calc(3.5rem + 1px);
        right: 0;
        left: 0;
        z-index: calc(var(--z-index-dropdown, 100) - 1);
        overflow: hidden;
        max-height: 0;
        transition: max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1),
          opacity 0.25s ease;
        opacity: 0;

        &.open {
          max-height: 320px;
          opacity: 1;
        }
      }

      .drawer-inner {
        margin: 0 auto;
        width: min(1180px, calc(100% - 2rem));
        padding: 1.25rem;
        background: color-mix(in srgb, var(--surface) 96%, transparent);
        backdrop-filter: blur(20px);
        border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
        border-top: none;
        border-radius: 0 0 var(--fc-card-radius, 18px)
          var(--fc-card-radius, 18px);
        box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
        display: grid;
        gap: 0.75rem;
      }

      .drawer-backdrop {
        position: fixed;
        inset: 0;
        z-index: calc(var(--z-index-dropdown, 100) - 2);
      }

      .drawer-label {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-weight: 700;
        color: var(--muted);
      }

      .plan-list {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .plan-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
        padding: 0.6rem 1.1rem;
        border-radius: var(--fc-button-radius, 9999px);
        background: color-mix(in srgb, var(--surface) 90%, var(--primary) 10%);
        color: var(--foreground);
        font-size: 0.82rem;
        font-weight: 600;
        border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          background: color-mix(in srgb, var(--primary) 15%, var(--surface));
          border-color: var(--primary);
          transform: translateY(-1px);
        }

        &.active {
          background: var(--primary);
          color: var(--background);
          border-color: var(--primary);
        }
      }

      .plan-pill-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.6;
        flex-shrink: 0;
      }

      .plan-pill.active .plan-pill-dot {
        opacity: 1;
        box-shadow: 0 0 6px currentColor;
      }

      /* ─── HERO ──────────────────────────────────────────────── */
      .hero-compact {
        grid-area: hero;
        position: relative;
        overflow: hidden;
        padding: 1rem clamp(1rem, 3vw, 2rem);
        background: color-mix(in srgb, var(--surface) 70%, transparent);
        border-bottom: 1px solid
          color-mix(in srgb, var(--border) 30%, transparent);
        animation: fadeUp 0.5s 0.15s
          var(--fc-transition-easing, cubic-bezier(0.16, 1, 0.3, 1)) both;
      }

      .hero-inner {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .hero-left {
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
        flex-wrap: wrap;
        min-width: 0;
      }

      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .hero-mesh {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        opacity: 0.35;
      }

      .hero-title {
        margin: 0;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: clamp(1.1rem, 3vw, 1.5rem);
        font-weight: 700;
        line-height: 1.2;
        color: var(--foreground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .hero-desc {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.5;
        color: var(--muted);
        max-width: 44ch;
      }

      .hero-right {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
      }

      .status-sep {
        color: var(--muted);
        font-size: 0.75rem;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--success, #22c55e);
        flex-shrink: 0;

        &.pulse {
          box-shadow: 0 0 0 0
            color-mix(in srgb, var(--success, #22c55e) 70%, transparent);
          animation: statusPulse 2.5s ease-in-out infinite;
        }
      }

      @keyframes statusPulse {
        0%,
        100% {
          box-shadow: 0 0 0 0
            color-mix(in srgb, var(--success, #22c55e) 70%, transparent);
        }
        50% {
          box-shadow: 0 0 0 6px
            color-mix(in srgb, var(--success, #22c55e) 0%, transparent);
        }
      }

      .status-text {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--success, #22c55e);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .status-meta {
        font-size: 0.68rem;
        color: var(--muted);
        text-transform: capitalize;
        letter-spacing: 0.04em;
      }

      /* ─── SUBNAV ─────────────────────────────────────────────── */
      .subnav {
        grid-area: subnav;
        position: sticky;
        top: calc(3.5rem + 1px);
        z-index: calc(var(--z-index-dropdown, 100) - 5);
        background: color-mix(in srgb, var(--background) 85%, transparent);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid
          color-mix(in srgb, var(--border) 35%, transparent);
        animation: fadeUp 0.5s 0.25s
          var(--fc-transition-easing, cubic-bezier(0.16, 1, 0.3, 1)) both;
      }

      .subnav-track {
        display: flex;
        gap: 0;
        overflow-x: auto;
        scrollbar-width: none;
        width: min(1180px, 100%);
        margin: 0 auto;
        padding: 0 1rem;

        &::-webkit-scrollbar {
          display: none;
        }
      }

      .nav-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.85rem 1.1rem;
        text-decoration: none;
        color: var(--muted);
        font-size: 0.82rem;
        font-weight: 600;
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          color: var(--foreground);
          border-bottom-color: color-mix(
            in srgb,
            var(--primary) 40%,
            transparent
          );
        }

        &.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }
      }

      .nav-icon {
        font-size: 1rem;
        opacity: 0.8;
      }

      .nav-label {
        /* hide on very small screens via media query below */
      }

      /* ─── CONTENT ────────────────────────────────────────────── */
      .shell-content {
        grid-area: content;
        width: min(1180px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 1.75rem 0 calc(5.5rem + env(safe-area-inset-bottom));
        animation: fadeUp 0.5s 0.35s
          var(--fc-transition-easing, cubic-bezier(0.16, 1, 0.3, 1)) both;
      }

      /* ─── MOBILE BOTTOM NAV ─────────────────────────────────── */
      .mobile-bottom-nav {
        display: none;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: var(--z-index-dropdown, 100);
        background: color-mix(in srgb, var(--background) 94%, transparent);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-top: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
        padding-bottom: env(safe-area-inset-bottom);
      }

      .bottom-nav-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        padding: 0.6rem 0.5rem;
        text-decoration: none;
        color: var(--muted);
        font-size: 0.65rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        transition: color 0.2s ease;

        &.active {
          color: var(--primary);
        }
      }

      .bottom-nav-icon {
        font-size: 1.35rem;
        line-height: 1;
      }

      .bottom-nav-label {
        font-size: 0.6rem;
      }

      /* ─── EMPTY / CREATE STATE ───────────────────────────────── */
      .create-shell {
        position: relative;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
        overflow: hidden;
      }

      .create-bg {
        position: absolute;
        inset: 0;
        opacity: 0.3;
        pointer-events: none;
      }

      .create-card {
        position: relative;
        z-index: 1;
        width: min(560px, 100%);
        padding: clamp(1.75rem, 4vw, 3rem);
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        backdrop-filter: blur(20px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 60%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
        display: grid;
        gap: 1.5rem;
        animation: fadeUp 0.6s 0.1s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .create-header {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .create-title {
        margin: 0.25rem 0 0;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: clamp(1.6rem, 4vw, 2.2rem);
        font-weight: 700;
        line-height: 1.1;
        color: var(--foreground);
      }

      .create-desc {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.65;
        color: var(--muted);
      }

      .create-form {
        display: grid;
        gap: 1.1rem;
      }

      .create-field {
        display: grid;
        gap: 0.4rem;
      }

      .field-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .field-input,
      .field-textarea {
        width: 100%;
        padding: 0.85rem 1rem;
        border-radius: var(--fc-input-radius, 14px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 60%, transparent);
        background: color-mix(in srgb, var(--surface) 70%, transparent);
        color: var(--foreground);
        font: inherit;
        font-size: 0.95rem;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        outline: none;

        &:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px
            color-mix(in srgb, var(--primary) 18%, transparent);
        }

        &::placeholder {
          color: color-mix(in srgb, var(--muted) 60%, transparent);
        }
      }

      .field-textarea {
        min-height: 6rem;
        resize: vertical;
      }

      .create-cta {
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 1rem 1.5rem;
        background: var(--primary);
        color: var(--background);
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 0.95rem;
        font-weight: 700;
        border: none;
        border-radius: var(--fc-button-radius, 9999px);
        cursor: pointer;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px
            color-mix(in srgb, var(--primary) 40%, transparent);
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }

      .cta-arrow {
        font-size: 1.1rem;
      }

      /* ─── RESPONSIVE ─────────────────────────────────────────── */
      @media (max-width: 700px) {
        .hero-right {
          display: none;
        }

        .subnav {
          display: none;
        }

        .mobile-bottom-nav {
          display: flex;
        }

        .shell-content {
          padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
        }

        .nav-label {
          display: none;
        }
      }

      @media (max-width: 480px) {
        .plan-name-short {
          max-width: 130px;
        }
      }
    `,
  ],
})
export class CommanderShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(FinCommanderPlanStore);
  private readonly permissions = inject(PermissionsService);
  private readonly routePlanId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('planId'))),
    { initialValue: this.route.snapshot.paramMap.get('planId') }
  );

  readonly planDrawerOpen = signal(false);

  readonly navItems: ShellNavItem[] = [
    {
      label: 'Overview',
      segment: 'overview',
      permission: 'finance.summary.read',
      icon: '◉',
    },
    {
      label: 'Cash Flow',
      segment: 'cash-flow',
      permission: 'finance.transaction.read',
      icon: '⇌',
    },
    {
      label: 'Goals',
      segment: 'goals',
      permission: 'finance.budget.read',
      icon: '◎',
    },
    {
      label: 'Scenarios',
      segment: 'scenarios',
      permission: 'finance.account.read',
      icon: '◈',
    },
    {
      label: 'Imports',
      segment: 'imports',
      permission: 'finance.account.read',
      icon: '⬆',
    },
  ];

  readonly plans = computed(() => {
    this.store.getScope();
    return this.store.listPlans();
  });
  readonly planId = computed(
    () => this.routePlanId() ?? this.plans()[0]?.id ?? null
  );
  readonly plan = computed(() => {
    const planId = this.planId();
    return planId ? this.store.getPlan(planId) ?? null : null;
  });
  readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => this.permissions.can(item.permission))
  );
  newPlanName = '';
  newPlanDescription = '';

  togglePlanDrawer(): void {
    this.planDrawerOpen.update((v) => !v);
  }

  @HostListener('document:keydown.escape')
  closePlanDrawer(): void {
    this.planDrawerOpen.set(false);
  }

  async createPlan(): Promise<void> {
    const name = this.newPlanName.trim();
    if (!name) {
      return;
    }

    const newPlanId = this.slugify(name);
    this.store.savePlan({
      id: newPlanId,
      name,
      description:
        this.newPlanDescription.trim() || 'First plan created from Commander.',
      defaultWorkspace: 'personal',
      updatedAt: new Date().toISOString(),
    });
    await this.router.navigate(['/commander', newPlanId, 'overview']);
  }

  private slugify(value: string): string {
    return `${
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'plan'
    }-${Date.now()}`;
  }
}
