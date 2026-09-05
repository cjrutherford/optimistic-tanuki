import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { ConfigurableLandingPageComponent } from '@optimistic-tanuki/configurable-client-ui';

import { LandingPageComponent } from './landing-page.component';
import { ConfigurationService } from '../services/configuration.service';

// Named interface rather than an index signature because
// noPropertyAccessFromIndexSignature is on for this project.
interface ConfigurationServiceStub {
  getCurrentConfiguration: jest.Mock<AppConfiguration | null, []>;
}

function makeConfig(
  overrides: Partial<AppConfiguration> = {}
): AppConfiguration {
  return {
    id: 'cfg-1',
    name: 'demo-app',
    landingPage: { layout: 'single-column', sections: [] },
    routes: [],
    features: {},
    theme: { mode: 'light' },
    active: true,
    ...overrides,
  };
}

describe('LandingPageComponent (shell)', () => {
  let configService: ConfigurationServiceStub;

  /** The rendered <app-landing-page> the shell delegates to. */
  function renderedChild(
    fixture: ComponentFixture<LandingPageComponent>
  ): ConfigurableLandingPageComponent {
    return fixture.debugElement.query(
      By.directive(ConfigurableLandingPageComponent)
    ).componentInstance;
  }

  beforeEach(async () => {
    configService = {
      getCurrentConfiguration: jest.fn().mockReturnValue(null),
    };

    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [{ provide: ConfigurationService, useValue: configService }],
    }).compileComponents();
  });

  it('renders the configuration held by the service when no input is bound', () => {
    const stored = makeConfig({ name: 'stored-app' });
    configService.getCurrentConfiguration.mockReturnValue(stored);

    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.resolvedConfig).toBe(stored);
    expect(renderedChild(fixture).config).toBe(stored);
  });

  it('prefers an explicitly bound config over the service', () => {
    configService.getCurrentConfiguration.mockReturnValue(
      makeConfig({ name: 'stored-app' })
    );
    const bound = makeConfig({ name: 'bound-app' });

    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.componentRef.setInput('config', bound);
    fixture.detectChanges();

    expect(fixture.componentInstance.resolvedConfig).toBe(bound);
    expect(renderedChild(fixture).config).toBe(bound);
    expect(configService.getCurrentConfiguration).not.toHaveBeenCalled();
  });

  it('re-resolves when the bound config changes', () => {
    const first = makeConfig({ name: 'first-app' });
    const second = makeConfig({ name: 'second-app' });

    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.componentRef.setInput('config', first);
    fixture.detectChanges();
    expect(renderedChild(fixture).config).toBe(first);

    fixture.componentRef.setInput('config', second);
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedConfig).toBe(second);
    expect(renderedChild(fixture).config).toBe(second);
  });

  it('falls back to the service when the bound config is cleared', () => {
    const stored = makeConfig({ name: 'stored-app' });
    configService.getCurrentConfiguration.mockReturnValue(stored);

    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.componentRef.setInput('config', makeConfig({ name: 'bound-app' }));
    fixture.detectChanges();

    fixture.componentRef.setInput('config', null);
    fixture.detectChanges();

    expect(fixture.componentInstance.resolvedConfig).toBe(stored);
    expect(renderedChild(fixture).config).toBe(stored);
  });

  it('ignores changes that do not touch the config input', () => {
    const stored = makeConfig({ name: 'stored-app' });
    configService.getCurrentConfiguration.mockReturnValue(stored);

    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();
    configService.getCurrentConfiguration.mockClear();

    fixture.componentRef.setInput('embeddedPreview', true);
    fixture.detectChanges();

    // embeddedPreview must reach the child without triggering another
    // config resolution.
    expect(configService.getCurrentConfiguration).not.toHaveBeenCalled();
    expect(fixture.componentInstance.resolvedConfig).toBe(stored);
    expect(renderedChild(fixture).embeddedPreview).toBe(true);
  });

  it('defaults embeddedPreview to false on the rendered landing page', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();

    expect(renderedChild(fixture).embeddedPreview).toBe(false);
    expect(fixture.componentInstance.resolvedConfig).toBeNull();
  });
});
