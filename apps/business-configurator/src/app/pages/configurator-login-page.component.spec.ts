import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';
import { ReturnIntentService } from '../state/return-intent.service';
import { ConfiguratorLoginPageComponent } from './configurator-login-page.component';

describe('ConfiguratorLoginPageComponent', () => {
  let fixture: ComponentFixture<ConfiguratorLoginPageComponent>;
  let component: ConfiguratorLoginPageComponent;

  it('returns an owner to a safe requested configurator route after sign-in', async () => {
    const auth = { login: jest.fn().mockResolvedValue({ data: {} }) };
    const router = { navigateByUrl: jest.fn().mockResolvedValue(true) };
    const returnIntent = { consume: jest.fn().mockReturnValue(null) };

    await TestBed.configureTestingModule({
      imports: [ConfiguratorLoginPageComponent],
      providers: [
        { provide: AuthStateService, useValue: auth },
        { provide: ReturnIntentService, useValue: returnIntent },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                returnUrl: '/workspaces/workspace-1/sites/north-star',
              }),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfiguratorLoginPageComponent);
    component = fixture.componentInstance;
    component.email = 'owner@example.com';
    component.password = 'safe-password';

    component.signIn();
    await Promise.resolve();

    expect(auth.login).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'safe-password',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith(
      '/workspaces/workspace-1/sites/north-star'
    );
  });

  it('consumes a previously stored safe intent only after sign-in succeeds', async () => {
    const auth = { login: jest.fn().mockResolvedValue({ data: {} }) };
    const router = { navigateByUrl: jest.fn().mockResolvedValue(true) };
    const returnIntent = {
      consume: jest.fn().mockReturnValue('/workspaces/one/authoring/store'),
    };

    await TestBed.configureTestingModule({
      imports: [ConfiguratorLoginPageComponent],
      providers: [
        { provide: AuthStateService, useValue: auth },
        { provide: ReturnIntentService, useValue: returnIntent },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConfiguratorLoginPageComponent);
    const component = fixture.componentInstance;
    component.email = 'owner@example.com';
    component.password = 'safe-password';

    component.signIn();
    await Promise.resolve();

    expect(returnIntent.consume).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith(
      '/workspaces/one/authoring/store'
    );
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/workspaces/workspace-1/sites/north-star\nalert(1)',
    '/login',
    '/login?returnUrl=/workspaces/workspace-1/sites/north-star',
  ])(
    'uses the configurator root after sign-in for unsafe return URL %s',
    async (returnUrl) => {
      const auth = { login: jest.fn().mockResolvedValue({ data: {} }) };
      const router = { navigateByUrl: jest.fn().mockResolvedValue(true) };

      await TestBed.configureTestingModule({
        imports: [ConfiguratorLoginPageComponent],
        providers: [
          { provide: AuthStateService, useValue: auth },
          { provide: Router, useValue: router },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { queryParamMap: convertToParamMap({ returnUrl }) },
            },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(ConfiguratorLoginPageComponent);
      const component = fixture.componentInstance;
      component.email = 'owner@example.com';
      component.password = 'safe-password';

      component.signIn();
      await Promise.resolve();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    }
  );
});
