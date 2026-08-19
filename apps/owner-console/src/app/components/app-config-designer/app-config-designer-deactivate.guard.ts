import type { CanDeactivateFn } from '@angular/router';

interface PendingChangesEditor {
  canDeactivate(): boolean;
}

export const appConfigDesignerDeactivateGuard: CanDeactivateFn<
  PendingChangesEditor
> = (component) => component.canDeactivate();
