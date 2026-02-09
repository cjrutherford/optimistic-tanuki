// Theme Styles Library - Shared styles for all UI libraries
//
// This library provides shared SCSS styles and mixins for consistent theming
// across all UI components in the Optimistic Tanuki application.
//
// ## Usage
//
// ### Importing Component Styles
// ```typescript
// import '@optimistic-tanuki/theme-styles/toolbar.scss';
// ```
//
// ### Using Mixins in SCSS
// ```scss
// @use '@optimistic-tanuki/theme-styles/mixins' as *;
//
// .my-component {
//   @include flex-center;
//   @include glass-morphism(10px, 0.2);
//
//   @include mobile {
//     flex-direction: column;
//   }
// }
// ```
//
// ### Container Queries
// ```scss
// .component-wrapper {
//   container-type: inline-size;
//   container-name: my-component;
// }
//
// .content {
//   @include container-md {
//     grid-template-columns: 1fr 1fr;
//   }
// }
// ```
//
// ### Reduced Motion Support
// ```scss
// .animated-element {
//   animation: slide-in 0.3s ease;
//
//   @include reduced-motion {
//     animation: none;
//   }
// }
// ```

// Version
export const VERSION = '1.0.0';

// Re-export any TypeScript utilities
export { MIXIN_CATEGORIES } from './lib/mixins/index';
