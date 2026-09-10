import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { WorkspaceDiscoveryStore } from '@optimistic-tanuki/app-config-data-access';
import { WorkspacePickerPageComponent } from './workspace-picker-page.component';

describe('WorkspacePickerPageComponent', () => {
  it('offers the same session-scoped business-site provision action when no workspace exists', async () => {
    const store = {
      workspaces: signal([]),
      loading: signal(false),
      error: signal(null),
      load: jest.fn(),
      provisionBusinessSite: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [WorkspacePickerPageComponent],
      providers: [
        provideRouter([]),
        { provide: WorkspaceDiscoveryStore, useValue: store },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkspacePickerPageComponent);
    fixture.detectChanges();
    const button = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ).find((element: HTMLButtonElement) =>
      element.textContent?.includes('Start a Business Site')
    ) as HTMLButtonElement | undefined;

    button?.click();
    expect(button).toBeTruthy();
    expect(store.provisionBusinessSite).toHaveBeenCalled();
  });

  it('renders entitled Business Site workspaces as canonical editor links', async () => {
    const store = {
      workspaces: signal([
        {
          workspaceId: 'workspace-1',
          kind: 'business-site',
          slug: 'north-star',
          displayName: 'North Star',
          appScope: 'business-site',
          status: 'active',
        },
      ]),
      loading: signal(false),
      error: signal(null),
      load: jest.fn(),
      provisionBusinessSite: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [WorkspacePickerPageComponent],
      providers: [
        provideRouter([]),
        { provide: WorkspaceDiscoveryStore, useValue: store },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkspacePickerPageComponent);
    fixture.detectChanges();

    const link = Array.from(fixture.nativeElement.querySelectorAll('a')).find(
      (element: HTMLAnchorElement) =>
        element.textContent?.includes('Open workspace')
    ) as HTMLAnchorElement | undefined;

    expect(store.load).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('North Star');
    expect(link?.getAttribute('href')).toContain(
      '/workspaces/workspace-1/sites/north-star'
    );
    expect(fixture.nativeElement.textContent).toContain('Author store catalog');
    expect(
      fixture.nativeElement.querySelector('a[href*="authoring/store"]')
    ).toBeTruthy();
  });
});
