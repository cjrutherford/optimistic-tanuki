export interface Principle {
  title: string;
  detail: string;
}

/**
 * Working principles. Keep them to practices the public repositories and
 * release notes show, and qualify anything that is not verified.
 */
export const PRINCIPLES: Principle[] = [
  {
    title: 'Understand the whole system',
    detail:
      'Interface, services, persistence, deployment, and operations all affect each other. Years of systems administration before software engineering taught me to follow a problem through every layer.',
  },
  {
    title: 'Simplify before adding',
    detail:
      'The first fix is usually removing a moving part or clarifying a boundary, not adding another tool on top.',
  },
  {
    title: 'Design for failure and recovery',
    detail:
      'Jobs that survive a restart, partial results that can be resumed, and updates that can be rolled back are designed in, not patched on later.',
  },
  {
    title: 'Prove it',
    detail:
      'Tests, CI, tagged releases, and written decisions back the claims. Where something has not been verified, I say so.',
  },
];
