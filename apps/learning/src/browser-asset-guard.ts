export function isBrowserAssetRequest(path: string): boolean {
  return /\.(?:css|js|mjs|map|wasm|woff2?|ttf|otf|json|webmanifest|ico|png|jpe?g|gif|svg|webp|avif)(?:$|\?)/i.test(
    path
  );
}
