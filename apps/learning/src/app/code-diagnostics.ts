/** A compiler complaint, positioned so the editor can mark it. */
export interface Diagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

// Go, C++ and most others: "main.go:6:2: undefined: foo", optionally with a
// leading "./" and optionally with an "error:" or "warning:" label.
const POSITIONED =
  /^\s*(?:\.\/)?[\w./\\-]+?\.(?:go|cpp|cc|rs|ts|js|c|h|hpp):(\d+):(\d+):\s*(.*)$/;

// Rust puts the message on one line and the position on the next:
//   error[E0425]: cannot find value `x` in this scope
//    --> main.rs:3:5
const RUST_ARROW = /^\s*-->\s*[\w./\\-]+:(\d+):(\d+)\s*$/;

// A bare "error: ..." or "warning: ..." with no position of its own.
const LABELLED = /^\s*(error|warning)(?:\[[^\]]+\])?:\s*(.*)$/;

// A thrown JavaScript error, which carries no "error:" label of its own:
// "ReferenceError: x is not defined".
const THROWN = /^\s*\w*Error\b.*$/;

// Node stack frames from a TypeScript run: "at file:///tmp/x/main.ts:3:9"
const NODE_FRAME = /\bmain\.ts:(\d+):(\d+)\)?\s*$/;

function severityOf(text: string): 'error' | 'warning' {
  return /^\s*warning\b/i.test(text) ? 'warning' : 'error';
}

/**
 * Turns raw compiler stderr into positioned diagnostics.
 *
 * Anything that cannot be placed is still returned, pinned to line 1, so a
 * message is never silently dropped just because it had no coordinates.
 */
export function parseCompilerErrors(errors: readonly string[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const unplaced: string[] = [];

  for (const raw of errors) {
    const text = raw.replace(/\s+$/, '');
    if (!text.trim()) continue;

    const arrow = RUST_ARROW.exec(text);
    if (arrow) {
      // Attach to the most recent message that had no position yet.
      const message = unplaced.pop() ?? 'Compilation failed';
      out.push({
        line: Number(arrow[1]),
        column: Number(arrow[2]),
        message: message.replace(LABELLED, '$2').trim() || message.trim(),
        severity: severityOf(message),
      });
      continue;
    }

    const positioned = POSITIONED.exec(text);
    if (positioned) {
      out.push({
        line: Number(positioned[1]),
        column: Number(positioned[2]),
        message: positioned[3].replace(/^(error|warning):\s*/i, '').trim(),
        severity: severityOf(positioned[3]),
      });
      continue;
    }

    const frame = NODE_FRAME.exec(text);
    if (frame) {
      const message = unplaced.pop() ?? text.trim();
      out.push({
        line: Number(frame[1]),
        column: Number(frame[2]),
        message: message.trim(),
        severity: 'error',
      });
      continue;
    }

    if (LABELLED.test(text) || THROWN.test(text)) {
      unplaced.push(text);
      continue;
    }
  }

  // Whatever never found coordinates still deserves to be seen.
  for (const message of unplaced) {
    out.push({
      line: 1,
      column: 1,
      message: message.replace(LABELLED, '$2').trim() || message.trim(),
      severity: severityOf(message),
    });
  }

  return out;
}
