import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

interface LegacyConfirmation {
  promise: Promise<boolean>;
  resolve: (decision: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class NavigationConfirmationService {
  private readonly router = inject(Router);
  private pendingTarget: string | null = null;
  private bypassTarget: string | null = null;
  private legacyConfirmation: LegacyConfirmation | null = null;

  readonly isPending = signal(false);

  get pendingTargetUrl(): string | null {
    return this.pendingTarget;
  }

  requestConfirmation(targetUrl: string): void {
    if (this.pendingTarget) return;

    this.pendingTarget = targetUrl;
    this.isPending.set(true);
  }

  /**
   * Keeps same-component scope changes compatible while they move to the
   * target-based navigation flow.
   */
  confirm(): Promise<boolean> {
    if (this.legacyConfirmation) return this.legacyConfirmation.promise;

    let resolve!: (decision: boolean) => void;
    const promise = new Promise<boolean>((decision) => {
      resolve = decision;
    });
    this.legacyConfirmation = { promise, resolve };
    this.isPending.set(true);
    return promise;
  }

  stay(): void {
    this.clearPendingConfirmation();
    this.resolveLegacyConfirmation(false);
  }

  leave(): void {
    const targetUrl = this.pendingTarget;
    if (!targetUrl) {
      this.resolveLegacyConfirmation(true);
      return;
    }

    this.clearPendingConfirmation();
    this.bypassTarget = targetUrl;
    void this.router.navigateByUrl(targetUrl);
  }

  resolve(decision: boolean): void {
    this.resolveLegacyConfirmation(decision);
  }

  consumeBypass(targetUrl: string): boolean {
    if (this.bypassTarget !== targetUrl) return false;

    this.bypassTarget = null;
    return true;
  }

  private clearPendingConfirmation(): void {
    this.pendingTarget = null;
    this.isPending.set(false);
  }

  private resolveLegacyConfirmation(decision: boolean): void {
    const confirmation = this.legacyConfirmation;
    if (!confirmation) return;

    this.legacyConfirmation = null;
    this.clearPendingConfirmation();
    confirmation.resolve(decision);
  }
}
