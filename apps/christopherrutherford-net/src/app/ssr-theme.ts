import { DOCUMENT } from '@angular/common';
import {
  EnvironmentProviders,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { ThemeRootSnapshot, ThemeService } from '@optimistic-tanuki/theme-lib';

/**
 * Write the theme into the server-rendered HTML.
 *
 * ThemeService only touches the DOM in the browser, so the first paint used
 * to come out unthemed and the whole page re-laid out once the app booted
 * (CLS ~0.14). Emitting the same root variables, attributes and body class on
 * the server makes the browser's later write a no-op for layout.
 */
export function provideSsrTheme(): EnvironmentProviders {
  return provideAppInitializer(() => {
    const snapshot = inject(ThemeService).getRootSnapshot();
    if (snapshot) {
      applyThemeSnapshot(inject(DOCUMENT), snapshot);
    }
  });
}

export function applyThemeSnapshot(
  document: Document,
  snapshot: ThemeRootSnapshot
): void {
  const declarations = Object.entries(snapshot.variables)
    .map(([property, value]) => `${property}:${value};`)
    .join('')
    // Keep a value from closing the style element.
    .replace(/</g, '\\3c ');

  const style = document.createElement('style');
  style.id = 'ssr-theme';
  style.textContent = `:root{${declarations}}`;
  document.head.appendChild(style);

  Object.entries(snapshot.attributes).forEach(([name, value]) =>
    document.documentElement.setAttribute(name, value)
  );
  document.body.classList.add(snapshot.bodyClass);
}
