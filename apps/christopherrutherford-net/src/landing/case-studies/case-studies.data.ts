export type CaseStudyTone = 'platform' | 'native' | 'media' | 'appliance';

export interface CaseStudy {
  id: string;
  name: string;
  category: string;
  tagline: string;
  stack: string[];
  problem: string;
  build: string;
  evidence: string;
  repoHref: string;
  releaseHref?: string;
  logoSrc?: string;
  initials: string;
  imageSrc?: string;
  imageAlt?: string;
  tone: CaseStudyTone;
}

/**
 * Public, source-linked case studies.
 *
 * Every claim here is limited to what the repository, its tests and its
 * release notes show. Do not add adoption, throughput or user numbers that
 * cannot be pointed at.
 */
export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'optimistic-tanuki',
    name: 'Optimistic Tanuki',
    category: 'Platform',
    tagline: 'One workspace behind a portfolio of products',
    stack: [
      'TypeScript',
      'Angular',
      'NestJS',
      'Nx',
      'PostgreSQL',
      'Docker',
      'Kubernetes',
    ],
    problem:
      'Every product needed the same identity, permissions, messaging and data layer. Copying those pieces into each application would have turned every shared change into a migration.',
    build:
      'A single Nx workspace with Angular clients, a gateway that terminates HTTP, SSE and WebSocket traffic, NestJS services that communicate over TCP, and shared libraries for contracts, UI, theme and persistence. Docker Compose runs the local stack; Kustomize overlays define the Kubernetes delivery.',
    evidence:
      'The platform is public under AGPL: applications, services, shared libraries, deployment tooling and the architecture documentation that maps them. Current build and test status sits on the repository Actions tab.',
    repoHref: 'https://github.com/cjrutherford/optimistic-tanuki',
    initials: 'OT',
    tone: 'platform',
  },
  {
    id: 'statocyst',
    name: 'Statocyst',
    category: 'Native client',
    tagline: 'A local-first player for media you own',
    stack: [
      'Angular',
      'Electron',
      'TypeScript',
      'libSQL',
      'Jellyfin',
      'Android',
      'Swift',
    ],
    problem:
      'A player for owned media cannot depend on a developer-run server. The library index, queue and play position have to survive offline use, restarts, and a phone that locks its screen.',
    build:
      'Shared contracts and a playback core behind an Electron host, with an embedded libSQL library and a migration ledger. The same workspace carries a Jellyfin client, an Android media service and an iOS/CarPlay browsing target. Music and podcasts keep separate saved queues, and only one is active.',
    evidence:
      'v2.3.0 is the current release. Electron end-to-end tests assert real playback progress, seek and skip, queue edits, and restart recovery at the restored position; Android Auto runtime evidence is recorded in the repository. The verified reference platform is Ubuntu under Xwayland, and macOS and Windows are not claimed.',
    repoHref: 'https://github.com/cjrutherford/statocyst',
    releaseHref: 'https://github.com/cjrutherford/statocyst/releases',
    logoSrc: 'assets/images/case-studies/statocyst.webp',
    initials: 'S',
    imageSrc: 'assets/images/case-studies/statocyst-now-playing.webp',
    imageAlt: 'Statocyst desktop player showing the now-playing view',
    tone: 'native',
  },
  {
    id: 'tuner-daemon',
    name: 'TunerDaemon',
    category: 'Media service',
    tagline: 'Self-hosted live TV, guide data and recording',
    stack: [
      'Node.js',
      'TypeScript',
      'SQLite',
      'FFmpeg',
      'Angular',
      'Docker',
      'SSE',
    ],
    problem:
      'Recording live television is a long-running process that fails in ordinary ways: a stream stalls, a provider rotates its token, a server reboots halfway through an episode.',
    build:
      'A recording engine that resolves the stream URL at execution time, writes segmented MP4 with partial-file recovery on restart, and keeps series rules scheduled as new guide data arrives. Background sync jobs persist across reboots and report progress over Server-Sent Events; channel matching falls back through exact IDs, normalized names and fuzzy matches.',
    evidence:
      'Published container images and versioned releases; the server test suite covers queueing, retry and shutdown resilience; the changelog records the recording and recovery behaviour instead of promising it.',
    repoHref: 'https://github.com/cjrutherford/epg-manager',
    releaseHref: 'https://github.com/cjrutherford/epg-manager/releases',
    initials: 'TD',
    imageSrc: 'assets/images/case-studies/tuner-daemon-guide.webp',
    imageAlt: 'TunerDaemon live guide and player interface',
    tone: 'media',
  },
  {
    id: 'homestead',
    name: 'Homestead',
    category: 'Appliance',
    tagline: 'A private cloud the customer actually owns',
    stack: ['Go', 'Debian', 'systemd', 'Docker Compose', 'Angular', 'SQLite'],
    problem:
      'Self-hosting usually means adopting someone else\u2019s control plane, then finding out the machine cannot be recovered without that vendor. An appliance has to stay operable with standard Linux tools.',
    build:
      'A native Go daemon under systemd, a homesteadctl CLI and an Angular dashboard over the same API, SQLite for operations and audit state, guided setup for networking and storage, signed package updates, and applications defined in Compose. Every configuration operation is available from both the CLI and the dashboard.',
    evidence:
      'v0.0.3 ships signed Debian packages for amd64 and arm64 and updates through an owner-approved APT transaction. Architecture decisions, conformance tests and deferred work are published in the repository.',
    repoHref: 'https://github.com/cjrutherford/homestead',
    releaseHref: 'https://github.com/cjrutherford/homestead/releases',
    logoSrc: 'assets/images/case-studies/homestead.webp',
    initials: 'H',
    tone: 'appliance',
  },
];
