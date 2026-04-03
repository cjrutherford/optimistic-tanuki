export type LeadContactPointKind = 'email' | 'phone' | 'link';

export type LeadContactPointSource = 'provider' | 'posting-page';

export interface LeadContactPoint {
  kind: LeadContactPointKind;
  value: string;
  href: string;
  label: string;
  source: LeadContactPointSource;
  isPrimary: boolean;
}
