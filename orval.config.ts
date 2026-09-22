import { defineConfig } from 'orval';

/**
 * O15b: generates the billing UI client from the exported gateway document.
 * The client lives inside the publishable billing-sdk (a separate internal
 * lib would violate the visibility:publishable boundary rule).
 * Regenerate: `pnpm run get-openapi && pnpm exec nx run
 * billing-sdk:generate`. Output is committed; CI fails on drift.
 */
export default defineConfig({
  billing: {
    input: {
      target: 'dist/openapi.json',
      filters: {
        tags: ['billing'],
      },
    },
    output: {
      target: 'libs/billing-sdk/src/generated/billing.ts',
      client: 'angular',
      clean: true,
    },
  },
  chat: {
    input: {
      target: 'dist/openapi.json',
      filters: {
        tags: ['chat'],
      },
    },
    output: {
      target: 'libs/chat-ui-data-access/src/generated/chat.ts',
      client: 'angular',
      clean: true,
    },
  },
  payments: {
    input: {
      target: 'dist/openapi.json',
      filters: {
        tags: ['payments'],
      },
    },
    output: {
      target: 'libs/payments-ui-data-access/src/generated/payments.ts',
      client: 'angular',
      clean: true,
    },
  },
  store: {
    input: {
      target: 'dist/openapi.json',
      filters: {
        tags: ['store'],
      },
    },
    output: {
      target: 'libs/store-data-access/src/generated/store.ts',
      client: 'angular',
      clean: true,
    },
  },
  social: {
    input: {
      target: 'dist/openapi.json',
      filters: {
        // 'communities' covers the same-backend legacy routes URL-identically;
        // canonical migration + shim removal is O14's call, not this slice's.
        tags: [
          'social',
          'community',
          'communities',
          'follow',
          'post',
          'comment',
          'reaction',
          'vote',
          'post-shares',
          'polls',
          'presence',
          'privacy',
          'activity',
          'feed',
          'notifications',
          'search',
          'social-events',
          'profile-analytics',
          'attachment',
        ],
      },
    },
    output: {
      target: 'libs/social-data-access/src/generated/social.ts',
      client: 'angular',
      clean: true,
    },
  },
  profile: {
    input: {
      target: 'dist/openapi.json',
      filters: {
        tags: ['profile', 'timeline', 'profile-analytics'],
      },
    },
    output: {
      target: 'libs/profile-ui-data-access/src/generated/profile.ts',
      client: 'angular',
      clean: true,
    },
  },
  learning: {
    input: {
      target: 'dist/openapi.json',
      filters: {
        tags: ['learning'],
      },
    },
    output: {
      target: 'libs/learning-ui-data-access/src/generated/learning.ts',
      client: 'angular',
      clean: true,
    },
  },
  blogging: {
    input: {
      target: 'dist/openapi.json',
      filters: {
        tags: [
          'blog',
          'blog-posts',
          'blog-events',
          'blog-components',
          'contact',
        ],
      },
    },
    output: {
      target: 'libs/blogging-data-access/src/generated/blogging.ts',
      client: 'angular',
      clean: true,
    },
  },
  finance: {
    input: {
      target: 'dist/openapi.json',
      filters: {
        tags: [
          'finance',
          'account',
          'transaction',
          'inventory-item',
          'budget',
          'financial invoice',
          'financial checkout',
          'fin-commander',
        ],
      },
    },
    output: {
      target: 'libs/finance/data-access/src/generated/finance.ts',
      client: 'angular',
      clean: true,
    },
  },
});
