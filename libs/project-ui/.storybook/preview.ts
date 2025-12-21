/**
 * Storybook Preview Configuration for Project UI
 * 
 * Note: AG Grid styles are loaded via CDN in preview-head.html to avoid
 * webpack font loading issues with base64-encoded fonts in the CSS.
 */

// You can add global decorators, parameters, or mocks here as needed.
export const parameters = {
	actions: { argTypesRegex: '^on[A-Z].*' },
};
