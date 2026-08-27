/**
 * @types/prismjs only declares the package entry point, which is the browser
 * bundle. We import the bare core instead, because the entry point runs a DOM
 * bootstrap that throws under Angular's server-side rendering shim.
 */
declare module 'prismjs/components/prism-core' {
  const Prism: typeof import('prismjs');
  export default Prism;
}
