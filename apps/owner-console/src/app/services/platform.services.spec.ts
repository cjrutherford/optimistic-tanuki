import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { ControlCenterService } from './control-center.service';
import { AppConfigService } from './app-config.service';
import { RegistryManagementService } from './registry-management.service';

describe('platform services', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('ControlCenterService', () => {
    let service: ControlCenterService;

    beforeEach(() => {
      service = TestBed.inject(ControlCenterService);
    });

    it('reads the public status', () => {
      let result: unknown;
      service.getPublicStatus().subscribe((r) => (result = r));
      const req = httpMock.expectOne('/admin-api/api/status/public');
      expect(req.request.method).toBe('GET');
      req.flush({ deploymentName: 'prod' });
      expect(result).toEqual({ deploymentName: 'prod' });
    });

    it('url-encodes the tag when previewing a rollout', () => {
      service.getRolloutPreview('release/1.0').subscribe();
      const req = httpMock.expectOne(
        '/admin-api/api/rollouts/preview?tag=release%2F1.0'
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('reads the latest rollout', () => {
      service.getLatestRollout().subscribe();
      const req = httpMock.expectOne('/admin-api/api/rollouts/latest');
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('starts a rollout with the tag in the body', () => {
      service.startRollout('v2').subscribe();
      const req = httpMock.expectOne('/admin-api/api/rollouts/start');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ tag: 'v2' });
      req.flush({});
    });

    it('reads the oauth inspection', () => {
      service.getOAuthInspection().subscribe();
      httpMock.expectOne('/admin-api/api/oauth/inspect').flush({});
    });

    it('reads the deployment health', () => {
      service.getDeploymentHealth().subscribe();
      httpMock.expectOne('/admin-api/api/deployment/health').flush({});
    });

    it('defaults the rollout history limit to 20', () => {
      service.getRolloutHistory().subscribe();
      httpMock.expectOne('/admin-api/api/rollouts/history?limit=20').flush([]);
    });

    it('honours an explicit rollout history limit', () => {
      service.getRolloutHistory(5).subscribe();
      httpMock.expectOne('/admin-api/api/rollouts/history?limit=5').flush([]);
    });

    it('reads deployment images', () => {
      service.getImages().subscribe();
      httpMock.expectOne('/admin-api/api/deployment/images').flush([]);
    });

    it('reads the oauth providers', () => {
      service.getOAuthProviders().subscribe();
      httpMock.expectOne('/admin-api/api/oauth/providers').flush({});
    });

    it('reads the oauth apps', () => {
      service.getOAuthApps().subscribe();
      httpMock.expectOne('/admin-api/api/oauth/apps').flush({ apps: [] });
    });
  });

  describe('AppConfigService', () => {
    let service: AppConfigService;

    beforeEach(() => {
      service = TestBed.inject(AppConfigService);
    });

    it('lists configurations', () => {
      service.getConfigurations().subscribe();
      const req = httpMock.expectOne('/api/app-config');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('reads a configuration by id', () => {
      service.getConfiguration('cfg1').subscribe();
      httpMock.expectOne('/api/app-config/cfg1').flush({});
    });

    it('reads a configuration by name', () => {
      service.getConfigurationByName('business').subscribe();
      httpMock.expectOne('/api/app-config/by-name/business').flush({});
    });

    it('reads a configuration by domain', () => {
      service.getConfigurationByDomain('example.com').subscribe();
      httpMock.expectOne('/api/app-config/by-domain/example.com').flush({});
    });

    it('creates a configuration', () => {
      const dto = { name: 'business' } as never;
      service.createConfiguration(dto).subscribe();
      const req = httpMock.expectOne('/api/app-config');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });

    it('updates a configuration', () => {
      const dto = { name: 'business-2' } as never;
      service.updateConfiguration('cfg1', dto).subscribe();
      const req = httpMock.expectOne('/api/app-config/cfg1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });

    it('publishes a configuration', () => {
      const dto = { notes: 'go live' } as never;
      service.publishConfiguration('cfg1', dto).subscribe();
      const req = httpMock.expectOne('/api/app-config/cfg1/publish');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });

    it('rolls back a configuration', () => {
      const dto = { version: 3 } as never;
      service.rollbackConfiguration('cfg1', dto).subscribe();
      const req = httpMock.expectOne('/api/app-config/cfg1/rollback');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });

    it('deletes a configuration', () => {
      service.deleteConfiguration('cfg1').subscribe();
      const req = httpMock.expectOne('/api/app-config/cfg1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('RegistryManagementService', () => {
    let service: RegistryManagementService;

    beforeEach(() => {
      service = TestBed.inject(RegistryManagementService);
    });

    it('reads the registry', () => {
      service.getRegistry().subscribe();
      const req = httpMock.expectOne('/api/registry/apps');
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: {} });
    });

    it('wraps the registry payload in a registry envelope on update', () => {
      const registry = { apps: [] } as never;
      service.updateRegistry(registry).subscribe();
      const req = httpMock.expectOne('/api/registry/apps');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ registry });
      req.flush({ success: true });
    });

    it('publishes the registry', () => {
      const dto = { version: '1.0.0' } as never;
      service.publishRegistry(dto).subscribe();
      const req = httpMock.expectOne('/api/registry/publish');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ success: true });
    });

    it('rolls the registry back', () => {
      const dto = { version: '0.9.0' } as never;
      service.rollbackRegistry(dto).subscribe();
      const req = httpMock.expectOne('/api/registry/rollback');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ success: true });
    });

    it('reads navigation links', () => {
      service.getLinks().subscribe();
      const req = httpMock.expectOne('/api/registry/links');
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [] });
    });

    it('wraps navigation links in a links envelope on update', () => {
      const links = [{ label: 'Home', href: '/' }] as never;
      service.updateLinks(links).subscribe();
      const req = httpMock.expectOne('/api/registry/links');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ links });
      req.flush({ success: true, data: [] });
    });

    it('reads the audit log', () => {
      service.getAuditLog().subscribe();
      const req = httpMock.expectOne('/api/registry/audit-log');
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [] });
    });
  });
});
