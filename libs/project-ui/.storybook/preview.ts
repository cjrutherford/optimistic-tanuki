/**
 * Storybook Preview Configuration for Project UI
 * 
 * Note: AG Grid styles are NOT imported here due to webpack font loading issues.
 * AG Grid tables will render without styling in Storybook, but the component
 * structure and behavior can still be verified. For styled previews, run the
 * actual application.
 */

// You can add global decorators, parameters, or mocks here as needed.
export const parameters = {
	actions: { argTypesRegex: '^on[A-Z].*' },
};
