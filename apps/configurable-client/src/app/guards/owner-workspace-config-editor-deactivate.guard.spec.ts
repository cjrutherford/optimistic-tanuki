import { TestBed } from '@angular/core/testing';
import { ownerWorkspaceConfigEditorDeactivateGuard } from './owner-workspace-config-editor-deactivate.guard';
import { NavigationConfirmationService } from '../services/navigation-confirmation.service';

describe('ownerWorkspaceConfigEditorDeactivateGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NavigationConfirmationService,
          useValue: {
            requestConfirmation: jest.fn(),
            consumeBypass: jest.fn().mockReturnValue(false),
          },
        },
      ],
    });
  });

  it('allows a clean editor to deactivate without requesting confirmation', () => {
    const editor = { isDirty: false, requestNavigationConfirmation: jest.fn() };

    expect(
      TestBed.runInInjectionContext(() =>
        ownerWorkspaceConfigEditorDeactivateGuard(
          editor as never,
          {} as never,
          {} as never,
          {} as never
        )
      )
    ).toBe(true);
  });

  it('records the next URL and returns false synchronously for a dirty editor', () => {
    const coordinator = TestBed.inject(
      NavigationConfirmationService
    ) as unknown as {
      requestConfirmation: jest.Mock;
      consumeBypass: jest.Mock;
    };
    const editor = { isDirty: true, requestNavigationConfirmation: jest.fn() };
    const nextState = { url: '/owner/workspace/north-star' };

    expect(
      TestBed.runInInjectionContext(() =>
        ownerWorkspaceConfigEditorDeactivateGuard(
          editor as never,
          {} as never,
          {} as never,
          nextState as never
        )
      )
    ).toBe(false);
    expect(coordinator.consumeBypass).toHaveBeenCalledWith(nextState.url);
    expect(editor.requestNavigationConfirmation).toHaveBeenCalledWith(
      nextState.url
    );
  });

  it('consumes a matching one-shot bypass before requesting confirmation', () => {
    const coordinator = TestBed.inject(
      NavigationConfirmationService
    ) as unknown as {
      requestConfirmation: jest.Mock;
      consumeBypass: jest.Mock;
    };
    coordinator.consumeBypass.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      ownerWorkspaceConfigEditorDeactivateGuard(
        { isDirty: true, requestNavigationConfirmation: jest.fn() } as never,
        {} as never,
        {} as never,
        { url: '/owner/workspace/north-star' } as never
      )
    );

    expect(result).toBe(true);
    expect(coordinator.requestConfirmation).not.toHaveBeenCalled();
  });
});
