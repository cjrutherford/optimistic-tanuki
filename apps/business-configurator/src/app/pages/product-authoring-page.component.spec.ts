import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { WorkspaceDiscoveryApiService } from '@optimistic-tanuki/app-config-data-access';
import { ProductAuthoringPageComponent } from './product-authoring-page.component';
import { StoreAuthoringShellComponent } from '@optimistic-tanuki/store-ui';
import { BlogAuthoringShellComponent } from '@optimistic-tanuki/blogging-ui';

describe('ProductAuthoringPageComponent', () => {
  it('passes the discovered workspace pair to the Blog shell', async () => {
    const api = {
      get: jest.fn(() =>
        of({
          workspaceId: 'workspace-1',
          kind: 'business-site',
          slug: 'north-star',
          displayName: 'North Star',
          appScope: 'business-site',
          status: 'active',
        })
      ),
    };
    await TestBed.configureTestingModule({
      imports: [ProductAuthoringPageComponent],
      providers: [
        { provide: WorkspaceDiscoveryApiService, useValue: api },
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                workspaceId: 'workspace-1',
                product: 'blogging',
              }),
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductAuthoringPageComponent);
    fixture.detectChanges();

    const shell = fixture.debugElement.query(
      (node) => node.componentInstance instanceof BlogAuthoringShellComponent
    ).componentInstance as BlogAuthoringShellComponent;
    expect(shell.workspaceId).toBe('workspace-1');
    expect(shell.workspaceSlug).toBe('north-star');
    expect(shell.appScope).toBe('business-site');
  });

  it('re-resolves the workspace before mounting the eligible Store shell', async () => {
    const api = {
      get: jest.fn(() =>
        of({
          workspaceId: 'workspace-1',
          kind: 'business-site',
          slug: 'north-star',
          displayName: 'North Star',
          appScope: 'business-site',
          status: 'active',
        })
      ),
    };
    await TestBed.configureTestingModule({
      imports: [ProductAuthoringPageComponent],
      providers: [
        { provide: WorkspaceDiscoveryApiService, useValue: api },
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                workspaceId: 'workspace-1',
                product: 'store',
              }),
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductAuthoringPageComponent);
    fixture.detectChanges();

    expect(api.get).toHaveBeenCalledWith('workspace-1');
    expect(
      fixture.nativeElement.querySelector('ot-store-authoring-shell')
    ).toBeTruthy();
    const storeShell = fixture.debugElement.query(
      (node) => node.componentInstance instanceof StoreAuthoringShellComponent
    ).componentInstance as StoreAuthoringShellComponent;
    expect(storeShell.workspaceId).toBe('workspace-1');
    expect(storeShell.workspaceSlug).toBe('north-star');
  });

  it('does not enable Store authoring for community workspaces', async () => {
    const api = {
      get: jest.fn(() =>
        of({
          workspaceId: 'community-1',
          kind: 'community',
          slug: 'makers',
          displayName: 'Makers',
          appScope: 'community',
          status: 'active',
        })
      ),
    };
    await TestBed.configureTestingModule({
      imports: [ProductAuthoringPageComponent],
      providers: [
        { provide: WorkspaceDiscoveryApiService, useValue: api },
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                workspaceId: 'community-1',
                product: 'store',
              }),
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductAuthoringPageComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-authoring-denied]')
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('ot-store-authoring-shell')
    ).toBeFalsy();
  });

  it('does not mount a shell when Gateway denies the workspace', async () => {
    const api = {
      get: jest.fn(() => throwError(() => new Error('Not found'))),
    };
    await TestBed.configureTestingModule({
      imports: [ProductAuthoringPageComponent],
      providers: [
        { provide: WorkspaceDiscoveryApiService, useValue: api },
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                workspaceId: 'foreign',
                product: 'social',
              }),
            },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductAuthoringPageComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-authoring-denied]')
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('ot-social-authoring-shell')
    ).toBeFalsy();
  });
});
