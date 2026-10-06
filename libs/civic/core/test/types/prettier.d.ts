// prettier 2 ships no types; declare the two calls the e2e test uses.
declare module 'prettier' {
  export function format(
    source: string,
    options?: Record<string, unknown>
  ): string;
  export const resolveConfig: {
    sync(filePath: string): Record<string, unknown> | null;
  };
}
