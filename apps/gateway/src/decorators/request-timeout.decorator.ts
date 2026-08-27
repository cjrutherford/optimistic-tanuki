import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by {@link RequestTimeoutInterceptor} to resolve a
 * per-route request timeout. Absence of the metadata means "use the gateway
 * default" (see GATEWAY_REQUEST_TIMEOUT_MS).
 */
export const REQUEST_TIMEOUT_METADATA = 'gateway:request-timeout-ms';

/**
 * Preset timeout (ms) applied by {@link LongRunning}. Sized for upstream
 * calls that legitimately take longer than a typical request/response hop,
 * e.g. LLM prompt generation via the AI orchestration service.
 */
export const LONG_RUNNING_REQUEST_TIMEOUT_MS = 120_000;

/**
 * Preset timeout (ms) applied by {@link ModelBound}, for routes whose latency
 * is set by an inference server rather than by our own code.
 *
 * Sized from measurement, not taste: against a local 4b model, resume parsing
 * took 102s, intro analysis 63s, and full topic analysis 164-332s. The 120s
 * {@link LONG_RUNNING_REQUEST_TIMEOUT_MS} preset cut all of those off, which
 * looks to the user exactly like the feature being broken.
 *
 * Ten minutes is deliberately generous rather than unbounded. It leaves room
 * for a cold model load on modest hardware, while still guaranteeing that a
 * hung model eventually releases the connection — an uncapped route never
 * does, which is fine for a debugging session and not fine in production.
 *
 * Override per environment with GATEWAY_MODEL_TIMEOUT_MS; a faster model host
 * should be dialled well below this.
 */
export const MODEL_BOUND_REQUEST_TIMEOUT_MS = (() => {
  const configured = Number(process.env.GATEWAY_MODEL_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 600_000;
})();

/**
 * A per-route timeout value. A positive number is a timeout in milliseconds;
 * `'none'` (or a non-positive number) disables the gateway timeout for the
 * route entirely — use this for genuinely open-ended proxies.
 */
export type RequestTimeoutValue = number | 'none';

/**
 * Override the gateway request timeout for a single handler or controller.
 *
 * @example
 *   @RequestTimeout(60_000) // wait up to 60s for the upstream service
 *   @RequestTimeout('none') // never time this route out at the gateway
 */
export const RequestTimeout = (ms: RequestTimeoutValue) =>
  SetMetadata(REQUEST_TIMEOUT_METADATA, ms);

/**
 * Mark a handler (or controller) as long running so it uses the extended
 * {@link LONG_RUNNING_REQUEST_TIMEOUT_MS} timeout instead of the gateway
 * default. Intended for LLM / heavy-compute proxy routes.
 */
export const LongRunning = (ms: number = LONG_RUNNING_REQUEST_TIMEOUT_MS) =>
  SetMetadata(REQUEST_TIMEOUT_METADATA, ms);

/**
 * Mark a handler whose duration is dictated by an inference server.
 *
 * Prefer this to `@RequestTimeout('none')` on model-backed routes: the point is
 * to survive slow generation, not to wait forever.
 */
export const ModelBound = (ms: number = MODEL_BOUND_REQUEST_TIMEOUT_MS) =>
  SetMetadata(REQUEST_TIMEOUT_METADATA, ms);
