import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TenantContextService } from '../tenant-context.service';
import { tenantRouteContextGuard } from './tenant-route-context.guard';

describe('tenantRouteContextGuard', () => {
  it('selects the tenant named by the canonical route before activating its children', async () => {
    const createUrlTree = jest.fn();
    const tenantContext = {
      activateRouteTenant: jest.fn().mockResolvedValue(true),
      activeTenant: jest.fn().mockReturnValue({ id: 'tenant-2' }),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: TenantContextService, useValue: tenantContext },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      tenantRouteContextGuard(
        { paramMap: { get: () => 'tenant-2' } } as never,
        { url: '/tenants/tenant-2/accounts/personal/accounts' } as never
      )
    );

    expect(tenantContext.activateRouteTenant).toHaveBeenCalledWith('tenant-2');
    expect(result).toBe(true);
  });
});
