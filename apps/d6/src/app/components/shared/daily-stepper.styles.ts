/**
 * Shared component styles for daily stepper modules (Daily Four / Daily Six).
 *
 * Both components render the same shell layout: a centered container with a
 * page title, a stepper card, a completion / loading modal overlay, and a
 * "Previous Entries" list. Only the stepper questions and submission DTOs
 * differ. This constant is the single source of truth for that shell — keep
 * any layout/token changes here so the two modules cannot drift.
 *
 * Consumed via Angular component `styles: [DAILY_STEPPER_SHARED_STYLES]`.
 * Token references (`var(--surface)`, `var(--foreground)`, etc.) resolve to
 * ThemeService-driven values; fallbacks preserve the legacy palette for
 * pre-bootstrap renders.
 */
export const DAILY_STEPPER_SHARED_STYLES = `
      :host {
        display: block;
      }

      .container {
        max-width: 800px;
        margin: 0 auto;
        padding: var(--spacing-lg, 24px);
      }

      .page-title {
        font-size: 2rem;
        font-weight: 600;
        margin-bottom: var(--spacing-lg, 24px);
        color: var(--foreground, #212121);
      }

      .stepper-card {
        margin-bottom: var(--spacing-lg, 24px);
      }

      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: var(--spacing-lg, 24px);
      }

      .modal-content {
        background: var(--surface, #ffffff);
        border-radius: var(--border-radius-lg, 12px);
        padding: var(--spacing-2xl, 48px);
        max-width: 500px;
        width: 100%;
        text-align: center;
        box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
      }

      .modal-content h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: var(--spacing-md, 16px);
        color: var(--foreground, #1f2937);
      }

      .modal-content p {
        color: var(--muted, #6b7280);
        margin-bottom: var(--spacing-md, 16px);
      }

      .modal-question {
        font-weight: 600;
        color: var(--foreground, #374151) !important;
      }

      .modal-actions {
        display: flex;
        gap: var(--spacing-md, 16px);
        justify-content: center;
        margin-top: var(--spacing-xl, 32px);
      }

      .loading-content {
        max-width: 400px;
      }

      .loading-spinner {
        margin-top: var(--spacing-lg, 24px);
        --spinner-size: 48px;
      }

      .entries-card {
        h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: var(--spacing-md, 16px);
          color: var(--foreground, #1f2937);
        }
      }

      .entries-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md, 16px);
      }

      .entry-item {
        padding: var(--spacing-md, 16px);
        background: var(--surface-alt, #f9fafb);
        border-radius: var(--border-radius-md, 8px);
        border: 1px solid var(--border, #e5e7eb);
      }

      .entry-date {
        font-size: 0.875rem;
        color: var(--muted, #6b7280);
        margin-bottom: var(--spacing-xs, 4px);
      }

      .entry-preview {
        color: var(--foreground, #374151);
        font-weight: 500;
      }

      .empty-state {
        color: var(--muted, #9ca3af);
        text-align: center;
        padding: var(--spacing-lg, 24px);
      }
    `;
