import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { NavigationConfirmationService } from '../services/navigation-confirmation.service';

interface OwnerWorkspaceConfigEditor {
  isDirty: boolean;
  requestNavigationConfirmation(targetUrl: string): void;
}

export const ownerWorkspaceConfigEditorDeactivateGuard: CanDeactivateFn<
  OwnerWorkspaceConfigEditor
> = (component, _currentRoute, _currentState, nextState) => {
  if (!component.isDirty) return true;

  const confirmation = inject(NavigationConfirmationService);
  if (confirmation.consumeBypass(nextState.url)) return true;

  component.requestNavigationConfirmation(nextState.url);
  return false;
};
