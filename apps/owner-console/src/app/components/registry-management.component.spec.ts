import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import {
  OwnerConfirmStub,
  createOwnerConfirmStub,
} from './owner-confirm.testing';
import { RegistryManagementComponent } from './registry-management.component';
import { RegistryManagementService } from '../services/registry-management.service';

describe('RegistryManagementComponent', () => {
  let confirmStub: OwnerConfirmStub;
  let registryService: {
    getRegistry: jest.Mock;
    updateRegistry: jest.Mock;
    getLinks: jest.Mock;
    updateLinks: jest.Mock;
    getAuditLog: jest.Mock;
    publishRegistry: jest.Mock;
    rollbackRegistry: jest.Mock;
    getDrift: jest.Mock;
    exportYaml: jest.Mock;
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
      getDrift: jest.fn().mockReturnValue(
        of({
          success: true,
          data: {
            state: 'in-sync',
            sourceHash: 'a',
            publishedHash: 'a',
            publishedVersion: 1,
            changedApps: [],
            addedInDatabase: [],
            missingFromDatabase: [],
            hasUnpublishedChanges: false,
          },
        })
      ),
      exportYaml: jest.fn().mockReturnValue(
        of({
          success: true,
          data: {
            yaml: 'version: 1.0.0\n',
            deployedYaml: 'version: 1.0.0\n',
            diff: '--- deployed/apps.yaml\n+++ database/apps.yaml\n@@ -1,1 +1,1 @@\n-a\n+b\n',
            identical: false,
            publishedVersion: 1,
            linksNotInYaml: 2,
          },
        })
      ),
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

    confirmStub = createOwnerConfirmStub({
      confirmed: true,
      reason: 'Bad launch',
    });
    await TestBed.configureTestingModule({
      imports: [RegistryManagementComponent],
      providers: [
        { provide: RegistryManagementService, useValue: registryService },
        { provide: OwnerConfirmService, useValue: confirmStub },
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

  it('removes links that reference a deleted app', async () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    await component.removeApp(1);

    expect(component.registry.apps.map((app) => app.appId)).toEqual(['hai']);
    expect(component.links).toEqual([]);
  });

  it('blocks save when the UI host does not match the app domain', async () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.registry.apps[0].uiBaseUrl = 'https://wrong.example.com';
    await component.saveRegistry();

    expect(component.validationErrors).toContain(
      'hai UI host must match haidev.com.'
    );
    expect(registryService.updateRegistry).not.toHaveBeenCalled();
  });

  it('blocks save when the icon url is not absolute', async () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.registry.apps[0].iconUrl = '/assets/logo.png';
    await component.saveRegistry();

    expect(component.validationErrors).toContain(
      'hai icon URL must be absolute.'
    );
    expect(registryService.updateRegistry).not.toHaveBeenCalled();
  });

  it('publishes the registry with release notes once it is ready', async () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.releaseNotes = 'Registry launch published.';
    component.changeSummary = 'Public app routing stabilized.';
    await component.publishRegistry();

    expect(registryService.publishRegistry).toHaveBeenCalledWith({
      releaseNotes: 'Registry launch published.',
      changeSummary: 'Public app routing stabilized.',
      reason: 'Bad launch',
    });
    expect(component.message).toContain('published');
    expect(component.release?.publishedVersion).toBe(3);
  });

  it('rolls back to a selected published revision, sending the reason for the audit log', async () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    await component.rollbackRegistry(2);

    expect(registryService.rollbackRegistry).toHaveBeenCalledWith({
      version: 2,
      releaseNotes: 'Bad launch',
      reason: 'Bad launch',
    });
    expect(component.message).toContain('rolled back');
    expect(component.release?.publishedVersion).toBe(2);
  });

  it('has a plain page header and no hero banner', () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('ot-owner-page-header')).not.toBeNull();
    expect(el.querySelector('.registry-hero')).toBeNull();
  });

  it('shows an error with Retry when the registry fails to load, not an empty editor', () => {
    registryService.getRegistry.mockReturnValue(
      throwError(() => ({ message: 'boom' }))
    );
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('ot-owner-state[kind="error"]')).not.toBeNull();
    expect(el.querySelector('.app-editor')).toBeNull();
    expect(el.textContent).toContain('Failed to load registry: boom');

    registryService.getRegistry.mockReturnValue(
      of({ success: true, data: { version: '1', generatedAt: '', apps: [] } })
    );
    (
      el.querySelector('ot-owner-state[kind="error"] button') as HTMLElement
    ).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.loadFailed).toBe(false);
  });

  it('reports a change-history failure with Retry instead of an empty list', () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    registryService.getAuditLog.mockReturnValue(throwError(() => ({})));

    fixture.componentInstance.loadAuditLog();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.auditError).toContain(
      'Failed to load the change history'
    );
    expect(el.querySelectorAll('ot-owner-state[kind="error"]')).toHaveLength(1);
  });

  it('asks for the app ID typed before removing an app', async () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    await component.removeApp(1);

    expect(confirmStub.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'typed',
        typedPhrase: 'store',
        destructive: true,
      })
    );
  });

  it('uses a plain confirmation for links and drafts, and a reason to publish or roll back', async () => {
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.releaseNotes = 'Notes';

    await component.removeLink(0);
    await component.saveRegistry();
    await component.saveLinks();
    await component.publishRegistry();
    await component.rollbackRegistry(2);

    const levels = confirmStub.confirm.mock.calls.map(([o]) => o.level);
    expect(levels).toEqual(['plain', 'plain', 'plain', 'reason', 'reason']);
  });

  it('changes nothing when the owner cancels', async () => {
    confirmStub.confirm.mockResolvedValue({ confirmed: false });
    const fixture = TestBed.createComponent(RegistryManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.releaseNotes = 'Notes';

    await component.removeApp(1);
    await component.publishRegistry();
    await component.rollbackRegistry(2);

    expect(component.registry.apps).toHaveLength(2);
    expect(registryService.publishRegistry).not.toHaveBeenCalled();
    expect(registryService.rollbackRegistry).not.toHaveBeenCalled();
  });

  describe('drift, export and audit', () => {
    const driftReport = (state: string, extra = {}) => ({
      success: true,
      data: {
        state,
        sourceHash: 'a',
        publishedHash: 'b',
        publishedVersion: 3,
        changedApps: [],
        addedInDatabase: [],
        missingFromDatabase: [],
        hasUnpublishedChanges: false,
        ...extra,
      },
    });

    it('shows an in-sync banner', () => {
      const fixture = TestBed.createComponent(RegistryManagementComponent);
      fixture.detectChanges();
      const banner = fixture.nativeElement.querySelector(
        '[data-testid="drift-banner"]'
      );
      expect(banner.textContent).toContain('in sync');
      expect(banner.classList).toContain('success');
    });

    it.each([
      ['db-ahead', 'database is ahead'],
      ['yaml-changed', 'YAML changed'],
      ['both', 'both changed'],
    ])('explains %s drift and lists differing apps', (state, text) => {
      registryService.getDrift.mockReturnValue(
        of(driftReport(state, { changedApps: ['hai'] }))
      );
      const fixture = TestBed.createComponent(RegistryManagementComponent);
      fixture.detectChanges();
      const banner = fixture.nativeElement.querySelector(
        '[data-testid="drift-banner"]'
      );
      expect(banner.textContent).toContain(text);
      expect(banner.textContent).toContain('Different in the database: hai');
      expect(banner.classList).not.toContain('success');
    });

    it('reports a drift failure without hiding the editor', () => {
      registryService.getDrift.mockReturnValue(
        throwError(() => ({ message: 'boom' }))
      );
      const fixture = TestBed.createComponent(RegistryManagementComponent);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="drift-error"]')
          .textContent
      ).toContain('boom');
      expect(fixture.componentInstance.loadFailed).toBe(false);
    });

    it('exports the YAML, downloads it and shows the diff', async () => {
      const fixture = TestBed.createComponent(RegistryManagementComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      const download = jest
        .spyOn(
          component as unknown as { downloadFile: () => void },
          'downloadFile'
        )
        .mockImplementation(() => undefined);

      await component.exportYaml();
      fixture.detectChanges();

      expect(registryService.exportYaml).toHaveBeenCalled();
      expect(download).toHaveBeenCalledWith(
        'apps.yaml',
        'version: 1.0.0\n',
        'text/yaml'
      );
      const panel = fixture.nativeElement.querySelector(
        '[data-testid="yaml-export"]'
      );
      expect(panel.textContent).toContain('+b');
      expect(component.message).toContain('Review the diff');

      component.downloadDiff();
      expect(download).toHaveBeenCalledWith(
        'apps.yaml.diff',
        expect.stringContaining('@@'),
        'text/x-diff'
      );
    });

    it('shows the stored actor and reason in the audit table', () => {
      expect(
        fixtureColumns(TestBed.createComponent(RegistryManagementComponent))
      ).toEqual(['occurredAt', 'event', 'actor', 'summary', 'reason']);
    });

    it('sends the removal as the reason when the draft is saved', async () => {
      const fixture = TestBed.createComponent(RegistryManagementComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.links = [];
      await component.removeApp(1);
      await component.saveRegistry();
      expect(registryService.updateRegistry).toHaveBeenCalledWith(
        expect.objectContaining({ apps: [expect.anything()] }),
        'Removed app store'
      );
    });
  });
});

function fixtureColumns(
  fixture: ComponentFixture<RegistryManagementComponent>
): string[] {
  return fixture.componentInstance.auditColumns.map(
    (column) => column.field as string
  );
}
