import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { of } from 'rxjs';
import { ConfigurationService } from '../services/configuration.service';
import { AuthSessionService } from '../services/auth-session.service';
import { TenantThemeService } from '../services/tenant-theme.service';
import { AppResolverComponent } from './app-resolver.component';

function relativeLuminance(hex: string): number {
  const channels = hex
    .match(/[0-9a-f]{2}/gi)
    ?.map((value) => parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) {
    throw new Error('Expected a full hex color in the contrast contract test.');
  }

  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first: string, second: string): number {
  const luminances = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a
  );
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

describe('AppResolverComponent P5 view states', () => {
  let fixture: ComponentFixture<AppResolverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppResolverComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigurationService, useValue: {} },
        {
          provide: TenantThemeService,
          useValue: { applyDefaults: jest.fn(), apply: jest.fn() },
        },
        {
          provide: AuthSessionService,
          useValue: {
            status: 'signed-out',
            sessionState$: of({ status: 'signed-out' }),
            restoreSession: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => null },
              queryParamMap: { get: () => null },
            },
          },
        },
        provideRouter([]),
        { provide: 'PLATFORM_ID', useValue: 'server' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppResolverComponent);
    fixture.detectChanges();
  });

  it('renders loading through the shared landing status primitive', () => {
    fixture.componentInstance.loading = true;
    fixture.componentInstance.error = null;
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('otui-landing-status')).not.toBeNull();
    expect(
      host.querySelector('.state-message[data-kind="loading"]')
    ).not.toBeNull();
    expect(host.querySelector('.loading-spinner')).toBeNull();
  });

  it('keeps the resolver loading message on an app-scoped AA-safe muted token', () => {
    fixture.componentInstance.loading = true;
    fixture.componentInstance.error = null;
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const styles = readFileSync(
      join(__dirname, 'app-resolver.component.ts'),
      'utf8'
    );

    expect(
      host.querySelector('otui-landing-status.configurable-client-status')
    ).not.toBeNull();
    expect(styles).toMatch(
      /--configurable-client-state-muted:\s*var\(\s*--foreground,\s*var\(--ot-client-public-foreground\)\s*\)/
    );
    expect(contrastRatio('#172033', '#f5f7fb')).toBeGreaterThanOrEqual(4.5);
  });

  it('renders errors through the shared landing status primitive', () => {
    fixture.componentInstance.loading = false;
    fixture.componentInstance.error = 'The requested app is unavailable.';
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('otui-landing-status')).not.toBeNull();
    expect(
      host.querySelector('.state-message[data-kind="error"]')
    ).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'The requested app is unavailable.'
    );
    expect(host.querySelector('.error-container')).toBeNull();
  });

  it('renders a valid resolved app as content without failure actions', () => {
    fixture.componentInstance.loading = false;
    fixture.componentInstance.error = null;
    fixture.componentInstance.outcome = 'resolved';
    fixture.componentInstance.publicRoot = false;
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('router-outlet')).not.toBeNull();
    expect(host.querySelector('otui-landing-status')).toBeNull();
  });

  it('distinguishes an unknown experience with discovery and demo recovery actions', () => {
    fixture.componentInstance.loading = false;
    fixture.componentInstance.error = 'The requested experience was not found.';
    fixture.componentInstance.outcome = 'unknown';
    fixture.componentInstance.workspaceSlug = 'owner-configurable-client-test';
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain("We couldn't find that experience");
    expect(host.textContent).toContain(
      'Check the link or return to discovery.'
    );
    expect(host.querySelector('a[href="/"]')?.textContent).toContain(
      'Back to discovery'
    );
    const demoLink = Array.from(
      host.querySelectorAll<HTMLAnchorElement>('a')
    ).find((link) => link.textContent?.includes('Preview the demo'));
    expect(demoLink).toBeDefined();
    expect(demoLink?.getAttribute('href')).toBe(
      '/app/demo-app?workspaceSlug=owner-configurable-client-test'
    );
    expect(host.querySelector('button')).toBeNull();
  });

  it('does not offer a demo recovery action for an unscoped unknown experience', () => {
    fixture.componentInstance.loading = false;
    fixture.componentInstance.error = 'The requested experience was not found.';
    fixture.componentInstance.outcome = 'unknown';
    fixture.componentInstance.workspaceSlug = null;
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'a[href^="/app/demo-app"]'
      )
    ).toBeNull();
  });

  it('distinguishes a misconfigured experience with an owner recovery action', () => {
    fixture.componentInstance.loading = false;
    fixture.componentInstance.error = 'This app has an invalid configuration.';
    fixture.componentInstance.outcome = 'misconfigured';
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('This experience needs setup');
    expect(host.textContent).toContain('The owner can sign in to repair it.');
    expect(host.querySelector('a[href="/login"]')?.textContent).toContain(
      'Owner sign in'
    );
    expect(host.querySelector('button')).toBeNull();
  });

  it('renders the anonymous root through the configurable public landing shell', () => {
    fixture.componentInstance.loading = false;
    fixture.componentInstance.error = null;
    fixture.componentInstance.publicRoot = true;
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('app-configurable-client-public-landing')
    ).not.toBeNull();
    expect(host.querySelector('otui-public-landing-header')).not.toBeNull();
  });

  it('renders authenticated root choices through the same public landing shell', () => {
    fixture.componentInstance.loading = false;
    fixture.componentInstance.error = null;
    fixture.componentInstance.publicRoot = true;
    fixture.componentInstance.rootMode = 'authenticated';
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Open owner workspace');
    expect(host.textContent).toContain('Preview a client app');
    expect(host.querySelector('a[href="/login"]')).toBeNull();
  });

  it('renders a retry action for a transient configuration failure', () => {
    fixture.componentInstance.loading = false;
    fixture.componentInstance.error = 'Try again later.';
    fixture.componentInstance.outcome = 'transient-failure';
    const retry = jest.spyOn(fixture.componentInstance, 'retry');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button'
    ) as HTMLButtonElement;
    expect(fixture.nativeElement.textContent).toContain(
      'The doorway is taking a moment'
    );
    expect(button?.textContent).toContain('Try again');
    button.click();
    expect(retry).toHaveBeenCalled();
  });
});
