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
