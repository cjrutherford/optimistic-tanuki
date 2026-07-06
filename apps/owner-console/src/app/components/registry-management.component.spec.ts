import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RegistryManagementComponent } from './registry-management.component';
import { RegistryManagementService } from '../services/registry-management.service';

describe('RegistryManagementComponent', () => {
  let registryService: {
    getRegistry: jest.Mock;
    updateRegistry: jest.Mock;
    getLinks: jest.Mock;
    updateLinks: jest.Mock;
    getAuditLog: jest.Mock;
    publishRegistry: jest.Mock;
    rollbackRegistry: jest.Mock;
  };

  beforeEach(async () => {
    registryService = {
      getRegistry: jest.fn().mockReturnValue(
        of({
          success: true,
          data: {
            version: '1.0.0',
            generatedAt: '2026-04-22T00:00:00Z',
            apps: [
              {
                appId: 'hai',
                name: 'HAI',
                domain: 'haidev.com',
                uiBaseUrl: 'https://haidev.com',
                apiBaseUrl: 'https://api.haidev.com',
                iconUrl: 'https://haidev.com/assets/logo.png',
                appType: 'client',
                visibility: 'public',
              },
              {
                appId: 'store',
                name: 'Store',
                domain: 'haidev.com',
                subdomain: 'store',
                uiBaseUrl: 'https://store.haidev.com',
                apiBaseUrl: 'https://api.haidev.com',
                iconUrl: 'https://store.haidev.com/assets/store-icon.png',
                appType: 'client',
                visibility: 'public',
              },
            ],
          },
        })
      ),
      updateRegistry: jest.fn().mockReturnValue(
        of({
          success: true,
          data: {
            version: '1.0.0',
            generatedAt: '2026-04-22T00:00:00Z',
            apps: [],
          },
          release: {
            status: 'changes-pending',
            previewUrl: 'https://haidev.com',
            publishedVersion: 2,
            publishedAt: '2026-07-03T10:00:00.000Z',
            releaseNotes: 'Registry baseline published.',
            changeSummary: 'Initial public routing set.',
            history: [],
          },
        })
      ),
      getLinks: jest.fn().mockReturnValue(
        of({
          success: true,
          data: [
            {
              linkId: 'hai-to-store',
              sourceAppId: 'hai',
              targetAppId: 'store',
              type: 'footer',
              label: 'Store',
            },
          ],
        })
      ),
      updateLinks: jest.fn().mockReturnValue(of({ success: true, data: [] })),
      getAuditLog: jest.fn().mockReturnValue(of({ success: true, data: [] })),
      publishRegistry: jest.fn().mockReturnValue(
        of({
          success: true,
          data: {
            registry: {
              version: '1.0.1',
              generatedAt: '2026-07-04T10:00:00.000Z',
              apps: [
                {
                  appId: 'hai',
                  name: 'HAI',
                  domain: 'haidev.com',
                  uiBaseUrl: 'https://haidev.com',
                  apiBaseUrl: 'https://api.haidev.com',
                  iconUrl: 'https://haidev.com/assets/logo.png',
                  appType: 'client',
                  visibility: 'public',
                },
              ],
            },
            links: [
              {
                linkId: 'hai-home',
                sourceAppId: 'hai',
                targetAppId: 'hai',
                type: 'nav',
                label: 'Home',
                path: '/',
              },
            ],
            release: {
              status: 'published',
              previewUrl: 'https://haidev.com',
              publishedVersion: 3,
              publishedAt: '2026-07-04T10:00:00.000Z',
              releaseNotes: 'Registry launch published.',
              changeSummary: 'Public app routing stabilized.',
              history: [],
            },
          },
        })
      ),
      rollbackRegistry: jest.fn().mockReturnValue(
        of({
          success: true,
          data: {
            registry: {
              version: '1.0.0',
              generatedAt: '2026-07-03T10:00:00.000Z',
              apps: [
                {
                  appId: 'hai',
                  name: 'HAI',
                  domain: 'haidev.com',
                  uiBaseUrl: 'https://haidev.com',
                  apiBaseUrl: 'https://api.haidev.com',
                  iconUrl: 'https://haidev.com/assets/logo.png',
                  appType: 'client',
                  visibility: 'public',
                },
              ],
            },
            links: [],
            release: {
              status: 'published',
              previewUrl: 'https://haidev.com',
              publishedVersion: 2,
              publishedAt: '2026-07-03T10:00:00.000Z',
              releaseNotes: 'Registry baseline published.',
              changeSummary: 'Initial public routing set.',
              history: [],
            },
          },
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [RegistryManagementComponent],
      providers: [
        { provide: RegistryManagementService, useValue: registryService },
      ],
    }).compileComponents();
  });

  it('loads registry apps, links, and audit entries on init', () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.registry.apps.map((app) => app.appId)).toEqual([
      'hai',
      'store',
    ]);
    expect(component.links[0].linkId).toBe('hai-to-store');
    expect(registryService.getAuditLog).toHaveBeenCalled();
    expect(component.releaseStatusLabel()).toBe('Draft');
  });

  it('removes links that reference a deleted app', () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.removeApp(1);

    expect(component.registry.apps.map((app) => app.appId)).toEqual(['hai']);
    expect(component.links).toEqual([]);
  });

  it('blocks save when the UI host does not match the app domain', () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.registry.apps[0].uiBaseUrl = 'https://wrong.example.com';
    component.saveRegistry();

    expect(component.validationErrors).toContain(
      'hai UI host must match haidev.com.'
    );
    expect(registryService.updateRegistry).not.toHaveBeenCalled();
  });

  it('blocks save when the icon url is not absolute', () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.registry.apps[0].iconUrl = '/assets/logo.png';
    component.saveRegistry();

    expect(component.validationErrors).toContain(
      'hai icon URL must be absolute.'
    );
    expect(registryService.updateRegistry).not.toHaveBeenCalled();
  });

  it('publishes the registry with release notes once it is ready', () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.releaseNotes = 'Registry launch published.';
    component.changeSummary = 'Public app routing stabilized.';
    component.publishRegistry();

    expect(registryService.publishRegistry).toHaveBeenCalledWith({
      releaseNotes: 'Registry launch published.',
      changeSummary: 'Public app routing stabilized.',
    });
    expect(component.message).toContain('published');
    expect(component.release?.publishedVersion).toBe(3);
  });

  it('rolls back the registry to a selected published revision', () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.rollbackRegistry(2);

    expect(registryService.rollbackRegistry).toHaveBeenCalledWith({
      version: 2,
      releaseNotes: 'Rollback from registry management',
    });
    expect(component.message).toContain('rolled back');
    expect(component.release?.publishedVersion).toBe(2);
  });
});
