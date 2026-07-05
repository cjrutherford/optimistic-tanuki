export type OwnerConsoleSliceStatus =
  | 'not-started'
  | 'in-progress'
  | 'complete'
  | 'blocked';

export interface OwnerConsoleSliceTrackerEntry {
  slice: string;
  name: string;
  status: OwnerConsoleSliceStatus;
  primaryDomains: string[];
  priority: 'P1' | 'P2';
  expectedOutcome: string;
}

export interface OwnerConsoleScoreImpactEntry {
  domain: 'Governance' | 'Experience' | 'Commerce' | 'CRM' | 'Community Ops';
  uxDelta: number;
  completenessDelta: number;
  practicalityDelta: number;
}

export const OWNER_CONSOLE_SLICE_TRACKER: OwnerConsoleSliceTrackerEntry[] = [
  {
    slice: '0',
    name: 'Theme and Personality Validation and Remediation',
    status: 'complete',
    primaryDomains: ['All'],
    priority: 'P1',
    expectedOutcome:
      'Make dark, light, and personality behavior consistent across the full console',
  },
  {
    slice: '1',
    name: 'Cross-Domain Operator Queue',
    status: 'complete',
    primaryDomains: ['All'],
    priority: 'P1',
    expectedOutcome:
      'Make the console feel action-driven rather than menu-driven',
  },
  {
    slice: '2',
    name: 'Governance Decision Support',
    status: 'complete',
    primaryDomains: ['Governance'],
    priority: 'P1',
    expectedOutcome: 'Safer RBAC administration and better operator confidence',
  },
  {
    slice: '3',
    name: 'Experience Release Management',
    status: 'complete',
    primaryDomains: ['Experience'],
    priority: 'P1',
    expectedOutcome: 'Make configuration changes publishable and reversible',
  },
  {
    slice: '4',
    name: 'Commerce Workflow Unification',
    status: 'complete',
    primaryDomains: ['Commerce'],
    priority: 'P1',
    expectedOutcome: 'Reduce fragmentation in day-to-day commerce operations',
  },
  {
    slice: '5',
    name: 'CRM Expansion',
    status: 'complete',
    primaryDomains: ['CRM'],
    priority: 'P2',
    expectedOutcome: 'Promote CRM from a single tool to a real domain',
  },
  {
    slice: '6',
    name: 'Community Ops Unification',
    status: 'complete',
    primaryDomains: ['Community Ops'],
    priority: 'P2',
    expectedOutcome: 'Unify moderation and locality governance into one model',
  },
  {
    slice: '7',
    name: 'Operational Confidence and Coverage Tracking',
    status: 'complete',
    primaryDomains: ['All'],
    priority: 'P2',
    expectedOutcome: 'Extend the console’s measurement model to all domains',
  },
  {
    slice: '8',
    name: 'Governance Traceability',
    status: 'complete',
    primaryDomains: ['Governance'],
    priority: 'P2',
    expectedOutcome:
      'Make governance decisions easier to trace, audit, and reverse safely',
  },
  {
    slice: '9',
    name: 'Experience Release Orchestration',
    status: 'complete',
    primaryDomains: ['Experience'],
    priority: 'P2',
    expectedOutcome:
      'Unify release visibility across configuration, theme, registry, and rollout surfaces',
  },
];

export const OWNER_CONSOLE_SLICE_7_PROJECTED_SCORE_IMPACT: OwnerConsoleScoreImpactEntry[] =
  [
    {
      domain: 'Governance',
      uxDelta: 0.1,
      completenessDelta: 0.2,
      practicalityDelta: 0.2,
    },
    {
      domain: 'Experience',
      uxDelta: 0.1,
      completenessDelta: 0.2,
      practicalityDelta: 0.2,
    },
    {
      domain: 'Commerce',
      uxDelta: 0.1,
      completenessDelta: 0.2,
      practicalityDelta: 0.2,
    },
    {
      domain: 'CRM',
      uxDelta: 0.2,
      completenessDelta: 0.7,
      practicalityDelta: 0.3,
    },
    {
      domain: 'Community Ops',
      uxDelta: 0.1,
      completenessDelta: 0.2,
      practicalityDelta: 0.2,
    },
  ];
