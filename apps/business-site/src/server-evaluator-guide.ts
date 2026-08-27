// The evaluator guide documents seeded demo accounts and their plaintext
// passwords for local QA. It must never be reachable once the server runs
// with NODE_ENV=production, which is how every real deployment (default
// docker-compose.yaml, k8s) starts this app -- only docker-compose.dev.yaml
// overrides NODE_ENV to development.
export function isEvaluatorGuideEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env['NODE_ENV'] !== 'production';
}
