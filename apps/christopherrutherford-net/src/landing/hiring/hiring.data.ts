export interface HiringHighlight {
  title: string;
  detail: string;
}

/**
 * Each highlight maps to a public repository and to its case study. Keep the
 * wording to what the source, tests and release notes support.
 */
export const HIRING_HIGHLIGHTS: HiringHighlight[] = [
  {
    title: 'Distributed TypeScript platform',
    detail:
      'Nx monorepo, Angular clients, NestJS services over TCP, a gateway for HTTP, SSE and WebSocket traffic, shared contracts, PostgreSQL.',
  },
  {
    title: 'Local-first native media client',
    detail:
      'Electron host, Android media service, iOS/CarPlay surface, embedded database, queues that survive a restart.',
  },
  {
    title: 'Self-hosted recording service',
    detail:
      'FFmpeg capture, partial-file recovery, retry and retention rules, persisted jobs, progress over Server-Sent Events.',
  },
  {
    title: 'Linux appliance control plane',
    detail:
      'Go daemon under systemd, CLI and dashboard over one API, signed package updates, applications defined in Compose.',
  },
];

export const HIRING_TARGETS = [
  'Full-stack engineering',
  'Platform and Linux',
  'Implementation and integration',
];
