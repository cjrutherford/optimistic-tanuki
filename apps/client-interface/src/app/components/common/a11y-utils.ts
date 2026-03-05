import { Injectable, inject, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class A11yService {
  private liveRegionId = 'a11y-live-region';

  constructor() {
    this.createLiveRegion();
  }

  private createLiveRegion(): void {
    if (typeof document === 'undefined') return;

    let region = document.getElementById(this.liveRegionId);
    if (!region) {
      region = document.createElement('div');
      region.id = this.liveRegionId;
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only';
      document.body.appendChild(region);
    }
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const region = document.getElementById(this.liveRegionId);
    if (region) {
      region.setAttribute('aria-live', priority);
      region.textContent = '';
      setTimeout(() => {
        if (region) {
          region.textContent = message;
        }
      }, 100);
    }
  }
}

export function createAriaLabel(
  label: string,
  describedBy?: string
): { 'aria-label': string; 'aria-describedby'?: string } {
  const result: { 'aria-label': string; 'aria-describedby'?: string } = {
    'aria-label': label,
  };
  if (describedBy) {
    result['aria-describedby'] = describedBy;
  }
  return result;
}

export function createButtonAria(
  pressed: boolean,
  label: string
): {
  role: string;
  'aria-label': string;
  'aria-pressed': boolean;
} {
  return {
    role: 'button',
    'aria-label': label,
    'aria-pressed': pressed,
  };
}

export function createFormFieldAria(
  label: string,
  hintId: string,
  placeholder?: string
): Record<string, string> {
  const result: Record<string, string> = {
    'aria-label': label,
    'aria-describedby': hintId,
  };
  if (placeholder) {
    result['placeholder'] = placeholder;
  }
  return result;
}
