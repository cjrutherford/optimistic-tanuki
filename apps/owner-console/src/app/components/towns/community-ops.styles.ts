/** Shared styles for the town pages. Colour comes from the theme only. */
export const TOWN_OPS_STYLES = `
      :host {
        display: block;
        padding: 24px;
      }

      .ops-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .entity-browser,
      .detail-panel {
        border-radius: var(--personality-card-radius, 24px);
        border: 1px solid var(--border-color, #d6d6d6);
        background: radial-gradient(
            circle at top right,
            color-mix(in srgb, var(--accent, #2563eb) 10%, transparent),
            transparent 32%
          ),
          linear-gradient(
            180deg,
            color-mix(
              in srgb,
              var(--surface, #ffffff) 96%,
              var(--background, #f3f4f6)
            ),
            color-mix(
              in srgb,
              var(--surface, #ffffff) 91%,
              var(--background, #f3f4f6)
            )
          );
        color: var(--foreground, #111827);
      }

      .hero,
      .entity-browser,
      .detail-panel {
        padding: 24px;
      }

      .hero-kicker,
      .detail-kicker,
      .entity-type {
        margin: 0 0 8px;
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 82%,
          var(--foreground, #111827)
        );
        font-size: var(--type-small, 0.8rem);
        font-weight: 700;
        letter-spacing: var(--personality-label-letter-spacing, 0.08em);
        text-transform: uppercase;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      .hero p {
        margin-top: 12px;
        max-width: 72ch;
        line-height: var(--line-height, 1.6);
      }

      .metrics-grid,
      .detail-grid {
        display: grid;
        gap: 16px;
      }

      .metrics-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .metric-card,
      .detail-card,
      .related-panel,
      .entity-card {
        border-radius: var(--personality-card-radius, 18px);
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 94%,
          transparent
        );
      }

      .metric-card,
      .detail-card,
      .related-panel {
        padding: 18px;
        display: grid;
        gap: 10px;
      }

      .metric-value {
        font-size: var(--type-h2, 2rem);
        font-weight: 700;
        color: var(--accent, #2563eb);
      }

      .workspace-shell {
        display: grid;
        grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }

      .panel-heading {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 16px;
        margin-bottom: 18px;
      }

      .panel-heading p {
        margin-top: 8px;
        line-height: var(--line-height, 1.5);
      }

      .filters {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 180px;
        gap: 12px;
        margin-bottom: 18px;
      }

      .search-input,
      .filter-select {
        width: 100%;
        min-height: 44px;
        padding: 0 14px;
        border-radius: var(--personality-input-radius, 12px);
        border: 1px solid var(--border-color, #d6d6d6);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .search-input:focus,
      .filter-select:focus {
        outline: none;
        border-color: var(--accent, #2563eb);
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--accent, #2563eb) 18%, transparent);
      }

      .entity-list {
        display: grid;
        gap: 12px;
      }

      .entity-card {
        display: grid;
        gap: 8px;
        padding: 16px;
        text-align: left;
        cursor: pointer;
        color: inherit;
        transition: transform 160ms ease, border-color 160ms ease,
          box-shadow 160ms ease;
      }

      .entity-card:hover,
      .entity-card.is-selected {
        transform: translateY(-1px);
        border-color: color-mix(
          in srgb,
          var(--accent, #2563eb) 42%,
          transparent
        );
        box-shadow: 0 12px 24px
          color-mix(in srgb, var(--foreground, #111827) 10%, transparent);
      }

      .entity-card__header,
      .action-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }

      .entity-card p,
      .entity-card small,
      .detail-card p,
      .related-panel p {
        line-height: var(--line-height, 1.5);
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
      }

      .pressure-copy {
        font-weight: 600;
        color: color-mix(
          in srgb,
          var(--warning, #b45309) 82%,
          var(--foreground, #111827)
        );
      }

      .entity-health,
      .detail-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 10px;
        border-radius: 9999px;
        background: color-mix(
          in srgb,
          var(--success, #15803d) 15%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--success, #15803d) 82%,
          var(--foreground, #111827)
        );
        font-size: var(--type-small, 0.76rem);
        font-weight: 700;
        text-transform: uppercase;
      }

      .entity-health.attention,
      .detail-status.attention {
        background: color-mix(
          in srgb,
          var(--warning, #b45309) 16%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--warning, #b45309) 82%,
          var(--foreground, #111827)
        );
      }

      .detail-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        margin: 18px 0;
      }

      .journal-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-top: 18px;
      }

      .related-entity-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
        margin-top: 12px;
      }

      .related-entity-card {
        display: grid;
        gap: 6px;
        padding: 14px;
        text-align: left;
        border-radius: var(--personality-card-radius, 14px);
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f3f4f6)
        );
        color: inherit;
        cursor: pointer;
      }

      .related-entity-card small {
        color: color-mix(in srgb, var(--foreground, #111827) 70%, transparent);
      }

      .journal-panel {
        display: grid;
        gap: 12px;
        padding: 18px;
        border-radius: var(--personality-card-radius, 18px);
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 94%,
          transparent
        );
      }

      .journal-heading {
        margin-bottom: 0;
      }

      .journal-textarea {
        width: 100%;
        padding: 12px 14px;
        border-radius: var(--personality-card-radius, 14px);
        border: 1px solid var(--border-color, #d6d6d6);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
        resize: vertical;
      }

      .journal-textarea:focus {
        outline: none;
        border-color: var(--accent, #2563eb);
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--accent, #2563eb) 18%, transparent);
      }

      .journal-input {
        width: 100%;
        min-height: 44px;
        padding: 0 14px;
        border-radius: var(--personality-card-radius, 14px);
        border: 1px solid var(--border-color, #d6d6d6);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .journal-input:focus {
        outline: none;
        border-color: var(--accent, #2563eb);
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--accent, #2563eb) 18%, transparent);
      }

      .case-form {
        display: grid;
        gap: 12px;
      }

      .journal-list {
        display: grid;
        gap: 10px;
      }

      .journal-entry {
        display: grid;
        gap: 6px;
        padding: 14px;
        border-radius: var(--personality-card-radius, 14px);
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 90%,
          var(--background, #f3f4f6)
        );
      }

      .journal-entry span,
      .journal-empty {
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
        line-height: var(--line-height, 1.5);
      }

      .action-group,
      .related-panel {
        margin-top: 18px;
      }

      .action-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 16px;
        border-radius: 9999px;
        text-decoration: none;
        font-weight: 700;
        border: 1px solid transparent;
        background: var(--accent, #2563eb);
        color: var(--on-primary, var(--primary-foreground, #ffffff));
      }

      .action-link.secondary {
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 88%,
          var(--background, #f3f4f6)
        );
        border-color: color-mix(
          in srgb,
          var(--accent, #2563eb) 22%,
          var(--border-color, #d6d6d6)
        );
        color: var(--foreground, #111827);
      }

      .empty-state {
        padding: 20px;
        border-radius: var(--personality-card-radius, 18px);
        border: 1px dashed var(--border-color, #d6d6d6);
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
      }

      .skeleton {
        opacity: 0.7;
      }

      @media (max-width: 1024px) {
        .workspace-shell {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        :host {
          padding: 16px;
        }

        .hero,
        .entity-browser,
        .detail-panel {
          padding: 18px;
          border-radius: var(--personality-card-radius, 20px);
        }

        .filters {
          grid-template-columns: 1fr;
        }
      }
`;
