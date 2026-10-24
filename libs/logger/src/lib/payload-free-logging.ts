import { Logger, LoggerService } from '@nestjs/common';
import { emitSafeDiagnostic, SafeDiagnosticLevel } from './safe-diagnostic';

/** Production diagnostic boundary. Unknown messages become a fixed event;
 * raw messages, Nest contexts, stack traces and console formatting arguments
 * never reach the diagnostic sink. Structured producers retain allowed fields.
 * This does not erase old logs or sanitize persisted business audit tables. */
export class PayloadFreeLogger implements LoggerService {
  constructor(private readonly write: (record: unknown) => void) {}

  private emit(level: SafeDiagnosticLevel, message: unknown): void {
    let event: unknown;
    try {
      if (message && typeof message === 'object')
        event = Object.getOwnPropertyDescriptor(message, 'event')?.value;
    } catch {
      /* Uninspectable input is rejected without serialization. */
    }
    emitSafeDiagnostic(
      { log: (record) => this.write({ level, ...(record as object) }) },
      event,
      message
    );
  }

  log(message: unknown, ..._ignored: unknown[]): void {
    this.emit('log', message);
  }
  error(message: unknown, ..._ignored: unknown[]): void {
    this.emit('error', message);
  }
  warn(message: unknown, ..._ignored: unknown[]): void {
    this.emit('warn', message);
  }
  debug(message: unknown, ..._ignored: unknown[]): void {
    this.emit('debug', message);
  }
  verbose(message: unknown, ..._ignored: unknown[]): void {
    this.emit('debug', message);
  }
  fatal(message: unknown, ..._ignored: unknown[]): void {
    this.emit('error', message);
  }
}

/** Install before Nest bootstrap. Deliberately no environment bypass: a debug
 * setting must not re-enable payload-bearing diagnostics in a release process. */
let installed = false;
export function installPayloadFreeLogging(): void {
  if (installed) return;
  installed = true;
  const write = console.log.bind(console);
  const logger = new PayloadFreeLogger((record) =>
    write(JSON.stringify(record))
  );
  Logger.overrideLogger(logger);
  console.log = (...args) => logger.log(args[0]);
  console.info = (...args) => logger.log(args[0]);
  console.warn = (...args) => logger.warn(args[0]);
  console.error = (...args) => logger.error(args[0]);
  console.debug = (...args) => logger.debug(args[0]);
  console.trace = (...args) => logger.debug(args[0]);
  console.dir = (...args) => logger.debug(args[0]);
  console.dirxml = (...args) => logger.debug(args[0]);
  console.table = (...args) => logger.debug(args[0]);
  console.assert = (condition) => {
    if (!condition) logger.error(undefined);
  };
  console.group = (...args) => logger.debug(args[0]);
  console.groupCollapsed = (...args) => logger.debug(args[0]);
  console.groupEnd = () => undefined;
  console.time = () => undefined;
  console.timeEnd = () => logger.debug(undefined);
  console.timeLog = () => logger.debug(undefined);
  console.count = () => logger.debug(undefined);
  console.countReset = () => undefined;
}
