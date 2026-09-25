import type { Request } from 'express';
import {
  getSsrEngineOptions,
  isTrustProxyEnabled,
  type SsrEngineOptions,
} from '@optimistic-tanuki/common-ui/ssr-config';

/** Engine options for `AngularNodeAppEngine` (cast to `never` at the call site). */
export function getOwnerConsoleEngineOptions(
  env: NodeJS.ProcessEnv = process.env
): SsrEngineOptions {
  return getSsrEngineOptions(env, {
    extraBaseUrls: [env['OWNER_CONSOLE_UI_BASE_URL']],
  });
}

export function isOwnerConsoleProxyTrusted(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return isTrustProxyEnabled(env);
}

export const getRequestUrl = (req: Request): string => {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host') || 'localhost';
  return `${protocol}://${host}${req.originalUrl}`;
};
