import 'jest-preset-angular/setup-jest';

/**
 * `URL.canParse` for the jsdom test environment.
 *
 * The two SSR specs here call `renderApplication` from
 * `@angular/platform-server`, whose `validateAllowedHosts` uses
 * `URL.canParse`. Node has had it since 18.17, but the URL that
 * jest-environment-jsdom installs as a global does not, so those specs fail
 * with `TypeError: URL.canParse is not a function`. Angular 20.2 did not reach
 * for it; 20.3 does, which is why this only appeared with the Angular bump.
 *
 * Scoped to this library because it is the only one whose specs render through
 * platform-server — the other 120 projects never touch that path.
 */
type UrlWithCanParse = typeof URL & {
  canParse?: (url: string | URL, base?: string | URL) => boolean;
};

const globalUrl = URL as UrlWithCanParse;

if (typeof globalUrl.canParse !== 'function') {
  globalUrl.canParse = (url: string | URL, base?: string | URL): boolean => {
    try {
      new URL(url as string, base as string | undefined);
      return true;
    } catch {
      return false;
    }
  };
}
