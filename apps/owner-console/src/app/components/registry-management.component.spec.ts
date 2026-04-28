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
});
