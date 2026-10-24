let installed = false;

/** Console output is diagnostic metadata, never an alternate content sink.
 * Preserve severity and suppress unreviewed messages/formatting arguments.
 * Browser network panels and developer extensions are not application sinks. */
export function installBrowserDiagnosticBoundary(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;
  const write = console.log.bind(console);
  const emit = (level: string) =>
    write(JSON.stringify({ event: 'browser.diagnostic', level }));
  for (const level of [
    'log',
    'info',
    'warn',
    'error',
    'debug',
    'trace',
    'dir',
    'dirxml',
    'table',
    'group',
    'groupCollapsed',
  ] as const)
    console[level] = () => emit(level);
  console.assert = (condition) => {
    if (!condition) emit('error');
  };
  console.groupEnd = () => undefined;
  console.time = () => undefined;
  console.timeEnd = () => emit('debug');
  console.timeLog = () => emit('debug');
  console.count = () => emit('debug');
  console.countReset = () => undefined;
}
