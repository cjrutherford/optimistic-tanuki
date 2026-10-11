/**
 * Finds hard-coded style values in HAI stylesheets that should come from the
 * theme and personality system (S020). Used by `style-tokens.spec.ts`.
 *
 * A declaration passes when its value reads tokens: `var(--token, fallback)`,
 * the `section.*` helpers (`space()`, `text-size()`, `display()`, `leading()`,
 * `timing()`), or a theme-styles mixin. Literals inside those calls are
 * fallbacks and are ignored.
 *
 * Allowed without comment:
 * - `0`, `none`, `auto`, `inherit`, `normal`, and percentages;
 * - relative units that already scale with type or viewport (`em`, `ch`,
 *   `vw`, `vh`, `fr`) outside font sizes;
 * - `1px` hairlines in borders and outlines;
 * - `font-weight: 400`, and `z-index` from -2 to 2 for local stacking;
 * - custom property definitions in the token layer (`app.component.scss`).
 *
 * Anything else needs `// token-exempt: <reason>` on the line above.
 */
export interface StyleLiteral {
  line: number;
  declaration: string;
  literal: string;
}

const CHECKED_PROPERTIES =
  /^(font|font-size|font-weight|font-family|line-height|letter-spacing|border(-[a-z]+)*-radius|box-shadow|text-shadow|transition(-duration|-timing-function)?|animation(-duration|-timing-function)?|z-index|opacity|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-width)?|outline(-width)?|padding(-[a-z-]+)?|margin(-[a-z-]+)?|gap|row-gap|column-gap|(min-|max-)?(width|height)|inset(-[a-z-]+)?|top|right|bottom|left|scroll-margin(-[a-z-]+)?)$/;

const LENGTH_OR_TIME = /(?<![\w.-])-?(\d*\.\d+|\d+)(px|rem|ms|s)(?![\w-])/;
const FONT_SIZE_RELATIVE = /(?<![\w.-])-?(\d*\.\d+|\d+)(em|ch)(?![\w-])/;
const UNITLESS = /(?<![\w.#-])-?(\d*\.\d+|\d+)(?![\w.%-])/;

/** Removes `name(...)` calls, including nested parentheses. */
function stripCalls(value: string, names: RegExp): string {
  let out = value;
  let match: RegExpExecArray | null;
  while ((match = names.exec(out))) {
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < out.length; end++) {
      if (out[end] === '(') depth++;
      if (out[end] === ')' && --depth === 0) break;
    }
    out = `${out.slice(0, match.index)} ${out.slice(end + 1)}`;
    names.lastIndex = 0;
  }
  return out;
}

function literalIn(property: string, rawValue: string): string | null {
  const value = stripCalls(
    rawValue,
    /\b(var|color-mix|section\.[a-z-]+|space|text-size|display|leading|timing|p\.[a-z-]+|rgba?|hsla?|url|cubic-bezier|steps|translate[XYZ]?|rotate|scale)\(/g
  ).replace(/![a-z]+/g, '');

  if (property === 'font-weight') {
    const weight = value.match(UNITLESS);
    return weight && weight[0] !== '400' ? weight[0] : null;
  }

  if (property === 'z-index') {
    const z = value.match(UNITLESS);
    return z && Math.abs(Number(z[0])) > 2 ? z[0] : null;
  }

  if (property === 'opacity' || property === 'line-height') {
    const n = value.match(UNITLESS);
    return n && !['0', '1'].includes(n[0]) ? n[0] : null;
  }

  if (property === 'font-size' || property === 'letter-spacing') {
    const relative = value.match(FONT_SIZE_RELATIVE);
    if (relative) return relative[0];
  }

  if (/^(border|outline)/.test(property) && !/radius/.test(property)) {
    const withoutHairlines = value.replace(/(?<![\w.-])1px(?![\w-])/g, ' ');
    const length = withoutHairlines.match(LENGTH_OR_TIME);
    return length ? length[0] : null;
  }

  if (property === 'font') {
    const n = value.match(LENGTH_OR_TIME) ?? value.match(UNITLESS);
    return n ? n[0] : null;
  }

  const length = value.match(LENGTH_OR_TIME);
  return length ? length[0] : null;
}

/** Joins each declaration onto one line and reports its literals. */
export function findStyleLiterals(
  source: string,
  options: { allowCustomProperties?: boolean } = {}
): StyleLiteral[] {
  const lines = source.split('\n');
  const found: StyleLiteral[] = [];
  let pending = '';
  let startLine = 0;
  let exempt = false;
  let exemptCarry = false;
  let inBlockComment = false;

  lines.forEach((raw, index) => {
    let line = raw.trim();

    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      return;
    }
    if (line.startsWith('/*')) {
      inBlockComment = !line.includes('*/');
      return;
    }
    if (line.startsWith('//')) {
      exemptCarry =
        /^\/\/\s*token-exempt:\s*\S+/.test(line) || (exemptCarry && !line);
      return;
    }

    line = line.replace(/\s\/\/.*$/, '');
    if (!pending) {
      const isDeclaration =
        /^-{0,2}[a-z][a-z-]*\s*:(?!:)/.test(line) &&
        !/^[a-z-]+:(hover|focus|active|not|is|where|has|first|last|nth|before|after|host|disabled|checked|focus-visible|focus-within|placeholder)/.test(
          line
        ) &&
        !line.endsWith('{') &&
        !line.endsWith(',');
      if (!isDeclaration) {
        exemptCarry = false;
        return;
      }
      pending = line;
      startLine = index + 1;
      exempt = exemptCarry;
      exemptCarry = false;
    } else {
      pending += ` ${line}`;
    }

    if (!/[;}]\s*$/.test(pending)) return;

    const declaration = pending.replace(/\s+/g, ' ').replace(/[;}]\s*$/, '');
    pending = '';
    const colon = declaration.indexOf(':');
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1);

    if (exempt) return;
    if (property.startsWith('--')) {
      if (!options.allowCustomProperties) {
        const literal = literalIn('custom', value);
        if (literal) found.push({ line: startLine, declaration, literal });
      }
      return;
    }
    if (!CHECKED_PROPERTIES.test(property)) return;

    const literal = literalIn(property, value);
    if (literal) found.push({ line: startLine, declaration, literal });
  });

  return found;
}
