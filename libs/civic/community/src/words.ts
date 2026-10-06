/**
 * Text as a sequence of comparable words: lower case, letters and digits
 * only, with curly quotes and dashes folded so a copied passage matches its
 * source however either was typeset.
 */
export function words(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/gu, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .map((word) => word.replace(/^'+|'+$/gu, ''))
    .filter(Boolean);
}
