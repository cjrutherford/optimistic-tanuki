export interface ServiceOffer {
  id: string;
  title: string;
  summary: string;
  deliverables: string[];
}

/**
 * Client-facing offers. These are the shapes of work the case studies
 * demonstrate; keep them scoped to what the repositories and releases support.
 */
export const SERVICE_ENTRIES: ServiceOffer[] = [
  {
    id: 'build',
    title: 'Build the product',
    summary:
      'A customer-facing application, an internal tool, or a workflow that has to exist. I take it from data model to deployed interface.',
    deliverables: [
      'Angular or React interface',
      'Node, NestJS, or Go service and data model',
      'Docker and CI delivery',
    ],
  },
  {
    id: 'untangle',
    title: 'Untangle the platform',
    summary:
      'Releases are slow, the services have drifted, and nobody wants to touch the deploy. I map the system, then simplify it in steps that ship.',
    deliverables: [
      'Service boundaries and shared contracts',
      'CI/CD and environment cleanup',
      'Observability, backups, and runbooks',
    ],
  },
  {
    id: 'recover',
    title: 'Recover the delivery',
    summary:
      'A project has stalled or outgrown its owner. I audit the code and the plan, then rebuild a path to a release the team can repeat.',
    deliverables: [
      'Audit with a sequenced plan',
      'Tests around the risky parts',
      'A release the team can run',
    ],
  },
  {
    id: 'direction',
    title: 'Set the technical direction',
    summary:
      'The team can build, but the boundaries, data model, and delivery path keep getting re-litigated. I make the decisions explicit and write them down.',
    deliverables: [
      'Architecture and service boundaries',
      'Sequencing and trade-off notes',
      'Decision records the team can follow',
    ],
  },
];
