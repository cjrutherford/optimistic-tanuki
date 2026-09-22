import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ClientProxy } from '@nestjs/microservices';

// Shared service-composition helpers (promoted verbatim from the gateway per
// O24 — single source). `Gateway*` names are historical: both the gateway and
// the AI orchestrator gate downstream clients through these.

export type GatewayComposition = {
  enabledServices: string[];
};

/**
 * Canonical gateway service registry (O23 coherence anchor). The single
 * source for valid `serviceId` values: the gateway builds its default
 * composition from it, and the orchestrator coherence spec asserts every
 * orchestrator downstream resolves into it (modulo its documented
 * non-gateway exception). Add a service here when it gains a gateway mount.
 */
export const GATEWAY_SERVICE_IDS = [
  'authentication',
  'profile',
  'social',
  'assets',
  'project-planning',
  'chat-collector',
  'telos-docs-service',
  'ai-orchestration',
  'blogging',
  'permissions',
  'store',
  'workspace',
  'app-configurator',
  'forum',
  'finance',
  'wellness',
  'classifieds',
  'payments',
  'lead-tracker',
  'system-configurator-api',
  'videos',
  'learning-service',
  'billing',
] as const;
export type ComposableEntry<T> = {
  id: string;
  requiredServices?: string[];
  value?: T;
};

export const normalizeGatewayComposition = (
  composition: Partial<GatewayComposition> | undefined,
  allServices: string[]
): GatewayComposition => ({
  enabledServices: composition?.enabledServices?.length
    ? [...composition.enabledServices].sort()
    : [...allServices].sort(),
});

export const loadGatewayCompositionFromFile = (
  compositionPath: string | undefined
): Partial<GatewayComposition> | undefined => {
  if (!compositionPath || !fs.existsSync(compositionPath)) {
    return undefined;
  }

  const contents = fs.readFileSync(compositionPath, 'utf8');
  return yaml.load(contents) as Partial<GatewayComposition>;
};

export const isServiceEnabled = (
  composition: GatewayComposition,
  service: string
): boolean => composition.enabledServices.includes(service);

export const filterEnabledEntries = <T>(
  entries: Array<ComposableEntry<T>>,
  composition: GatewayComposition
): Array<ComposableEntry<T>> =>
  entries.filter((entry) =>
    (entry.requiredServices || []).every((service) =>
      isServiceEnabled(composition, service)
    )
  );

/**
 * Fail-fast stand-in for a composition-disabled downstream service.
 * Promoted verbatim from the gateway per O24.
 */
export class DisabledClientProxy extends ClientProxy {
  constructor(private readonly serviceId: string) {
    super();
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {}

  unwrap<T>(): T {
    return undefined as T;
  }

  protected publish(
    _packet: any,
    callback: (packet: { err: Error; isDisposed: boolean }) => void
  ): () => void {
    callback({
      err: new Error(`Gateway service "${this.serviceId}" is disabled`),
      isDisposed: true,
    });
    return () => undefined;
  }

  protected dispatchEvent(): Promise<never> {
    return Promise.reject(
      new Error(`Gateway service "${this.serviceId}" is disabled`)
    );
  }
}
