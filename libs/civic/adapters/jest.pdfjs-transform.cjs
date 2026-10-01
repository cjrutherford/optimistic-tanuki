/**
 * Jest runs CommonJS, and pdfjs-dist 4 ships only ES modules that read
 * import.meta.url. Webpack handles both for the built service; under Jest this
 * rewrites import.meta.url to its CommonJS equivalent and transpiles the
 * module (including the dynamic import of its worker) with TypeScript.
 */
const ts = require('typescript');

module.exports = {
  process(source, filename) {
    // pdfjs declares its own `require` from import.meta.url, so the URL is
    // computed once up front under a name it doesn't use.
    const rewritten =
      "const __civicModuleUrl = require('node:url').pathToFileURL(__filename).href;\n" +
      source.replace(/\bimport\.meta\.url\b/g, '__civicModuleUrl');
    const { outputText } = ts.transpileModule(rewritten, {
      // A .mjs name would make TypeScript keep ES module output.
      fileName: filename.replace(/\.mjs$/, '.js'),
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        allowJs: true,
        esModuleInterop: true,
      },
    });
    return { code: outputText };
  },
};
