import {
  ApplicationRef,
  EnvironmentInjector,
  Injectable,
  createComponent,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { OwnerConfirmDialogComponent } from './owner-confirm-dialog.component';
import type {
  OwnerConfirmOptions,
  OwnerConfirmResult,
} from './owner-confirm.types';

/**
 * Opens the confirmation dialog and resolves with the owner's answer.
 *
 * ```ts
 * const { confirmed, reason } = await this.confirm.confirm({
 *   level: 'reason',
 *   title: 'Suspend user',
 *   body: 'They will be signed out.',
 *   confirmLabel: 'Suspend',
 *   destructive: true,
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class OwnerConfirmService {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);

  confirm(options: OwnerConfirmOptions): Promise<OwnerConfirmResult> {
    if (options.level === 'typed' && !options.typedPhrase) {
      return Promise.reject(
        new Error('A typed confirmation needs a typedPhrase.')
      );
    }
    return new Promise((resolve) => {
      const ref = createComponent(OwnerConfirmDialogComponent, {
        environmentInjector: this.injector,
      });
      ref.setInput('options', options);
      this.appRef.attachView(ref.hostView);
      this.document.body.appendChild(ref.location.nativeElement);
      const sub = ref.instance.resolved.subscribe((result) => {
        sub.unsubscribe();
        this.appRef.detachView(ref.hostView);
        ref.destroy();
        resolve(result);
      });
      ref.changeDetectorRef.detectChanges();
    });
  }
}
