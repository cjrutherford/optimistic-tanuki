import * as fs from 'fs';
import * as yaml from 'js-yaml';

export type GatewayComposition = {
  enabledServices: string[];
};

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
