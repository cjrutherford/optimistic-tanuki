export type CaseStudyTone = 'platform' | 'native' | 'media' | 'appliance';

export interface CaseStudy {
  id: string;
  name: string;
  category: string;
  tagline: string;
  /** At most six items. */
  stack: string[];
  problem: string;
  constraints: string;
  decision: string;
  rationale: string;
  tradeoffs: string;
  evidence: string;
  status: string;
  repoHref: string;
  releaseHref?: string;
  architectureHref?: string;
  featured: boolean;
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
 * release notes show, and is listed in docs/public-claims.md. Do not add
 * adoption, throughput, user or project-count numbers, and do not link to
 * playable media.
 */
export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'optimistic-tanuki',
    name: 'Optimistic Tanuki',
    category: 'Platform',
    tagline: 'Keeping a multi-product platform consistent',
    stack: ['TypeScript', 'Angular', 'NestJS', 'Nx', 'Go', 'Kubernetes'],
    problem:
      'A portfolio of products needs the same identity, permissions, messaging and data layer. Copying those pieces into each application would turn every shared change into a migration across many codebases, so consistency has to be enforced by tooling rather than convention.',
    constraints:
      'Clients, services and infrastructure move at different speeds, and deployment targets include both Compose and Kubernetes. Not every application is at the same maturity.',
    decision:
      'One Nx workspace with tagged dependency boundaries, shared contract, UI and theme libraries, and a gateway that terminates HTTP, SSE and WebSocket traffic in front of NestJS services on TCP. A Go tool compiles one deployment inventory that Compose, Kubernetes and CI all read.',
    rationale:
      'A single inventory and generated API clients mean drift fails a CI check instead of surfacing in a deployment.',
    tradeoffs:
      'A large monorepo with slow full builds and a transitional boundary allowlist; end-to-end coverage and per-product maturity are uneven.',
    evidence:
      'CI runs migration governance, API-client drift checks, formatting, affected lint, test and build, and the Go inventory tests. Architecture notes document the Nx boundaries and the delivery pipeline.',
    status:
      'Public AGPL monorepo, actively developed · no tagged releases · applications range from alpha to stable',
    repoHref: 'https://github.com/cjrutherford/optimistic-tanuki',
    architectureHref:
      'https://github.com/cjrutherford/optimistic-tanuki/blob/main/docs/architecture/nx-boundaries.md',
    featured: true,
    initials: 'OT',
    tone: 'platform',
  },
  {
    id: 'homestead',
    name: 'Homestead',
    category: 'Appliance',
    tagline: 'Private cloud non-experts can own and recover',
    stack: ['Go', 'systemd', 'SQLite', 'Docker Compose', 'Angular', 'Debian'],
    problem:
      'A home server for non-technical owners has to be installable, updatable and recoverable without a vendor control plane. The update path runs as root, so a compromised or mistaken update could take over the machine. Applications also need a lifecycle that survives restarts and manual intervention.',
    constraints:
      'The owner is not a sysadmin, there is no cloud service to fall back on, and the appliance must stay operable with ordinary Linux tools (systemd, Docker Compose, dpkg).',
    decision:
      'A native Go daemon under systemd, with homesteadctl and an Angular dashboard sharing one API, SQLite for operations and audit state, applications as Compose projects, and a separate privileged apply unit that installs only an owner-approved package whose checksums verify against an offline minisign signature.',
    rationale:
      'Standard Linux primitives keep the machine recoverable, and keeping the apply step in its own unit and verifying a signed manifest limits what an update can do.',
    tradeoffs:
      'Release signing is a manual offline owner step, so there is no automated package publication yet.',
    evidence:
      'Go unit tests cover release-signature verification and the Debian updater (exact package, version and architecture checks; fixed dpkg commands), and Python tests cover the package builder. ADRs 025 and 063 and the release-verification notes document the design and deferred work.',
    status:
      'Pre-release (v0.0.3 draft, not yet public) · amd64 and arm64 .deb builds exist but are not yet signed or install-tested on an appliance',
    repoHref: 'https://github.com/cjrutherford/homestead',
    architectureHref:
      'https://github.com/cjrutherford/homestead/blob/main/docs/ARCHITECTURE.md',
    featured: true,
    logoSrc: 'assets/images/case-studies/homestead.webp',
    initials: 'H',
    tone: 'appliance',
  },
  {
    id: 'channel-loom',
    name: 'ChannelLoom',
    category: 'Media service',
    tagline: 'Keeping live playback independent of storage',
    stack: ['Rust', 'FFmpeg', 'HLS', 'SQLite', 'Tauri', 'Android TV'],
    problem:
      'Turning a personal library into always-on channels means slow, storage-heavy work (reading sources, transcoding, copying) competes with a viewer who needs the next segment now. A stalled disk, network mount or FFmpeg process must not take a channel off air. The schedule also has to be reproducible so a restart resumes at the right point.',
    constraints:
      'Sources are heterogeneous and some are slow, hardware encoders behave differently from software, and the same server must run on modest hardware.',
    decision:
      'Separate acquisition from playback: a pure, deterministic timeline builder feeds per-channel supervised runtimes that run one FFmpeg process per item and publish HLS segments atomically, while a precache worker copies or proxies upcoming media into an LRU-bounded cache at a capped rate.',
    rationale:
      'Isolating each item in its own process and bounding background I/O keeps a failure or slow source from stalling the live edge, and a slate fallback covers gaps.',
    tradeoffs:
      'More moving parts and disk use, VAAPI is the only hardware path, and the released server targets linux-amd64 only.',
    evidence:
      'CI runs rustfmt, clippy with warnings denied, the Rust workspace tests, Docker, Android TV and desktop builds, and releases are tag-built from the same workflow. The scheduler and engine design are recorded in ADRs 0003 and 0004; Playwright E2E is run manually, not in CI.',
    status:
      'Released v0.1.2 · linux-amd64 server, Tauri .deb and debug-signed Android TV APK · ARM unvalidated; Plex and remote-HTTP sources not started',
    repoHref: 'https://github.com/cjrutherford/channel-loom',
    releaseHref:
      'https://github.com/cjrutherford/channel-loom/releases/tag/v0.1.2',
    architectureHref:
      'https://github.com/cjrutherford/channel-loom/blob/main/docs/adr/0004-engine.md',
    featured: true,
    initials: 'CL',
    tone: 'media',
  },
  {
    id: 'statocyst',
    name: 'Statocyst',
    category: 'Native client',
    tagline: 'Playback that survives offline and restarts',
    stack: [
      'TypeScript',
      'Angular',
      'Electron',
      'libSQL',
      'Kotlin/Media3',
      'Swift',
    ],
    problem:
      'A player for owned media cannot rely on a server to remember what is playing. The queue and play position must survive going offline, an app restart, and a phone that locks its screen. Playback also runs in separate runtimes (desktop, Android service, iOS) that each own their own audio.',
    constraints:
      'Three native runtimes with different lifecycles, and the user’s library may be local files or a self-run Jellyfin server.',
    decision:
      'Shared contracts and a playback and queue core drive an Electron host with an embedded libSQL database and versioned migrations, while Android keeps playback in a native Media3 service and iOS in an AVPlayer service. Music and podcasts keep separate persisted queues.',
    rationale:
      'Persisting state locally, behind typed adapters, lets each platform restore from its own durable state instead of a remote one.',
    tradeoffs:
      'No cross-device sync, and Chromium audio on desktop rather than a native backend, so gapless playback is deferred.',
    evidence:
      'Unit specs cover the queue and playback service, and a local Electron end-to-end test checks real playback, seek, skip, queue edits and restoring the same track and position after a restart. Android Auto and screen-off runtime evidence is recorded in the repository’s evidence folder.',
    status:
      'Released v2.3.0 · desktop verified on Ubuntu (Xwayland), Electron e2e run locally, not in CI · Android runtime-recorded · iOS/CarPlay, macOS and Windows builds not device-tested',
    repoHref: 'https://github.com/cjrutherford/statocyst',
    releaseHref:
      'https://github.com/cjrutherford/statocyst/releases/tag/v2.3.0',
    architectureHref:
      'https://github.com/cjrutherford/statocyst/blob/main/statocyst-architecture-pack/README.md',
    featured: true,
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
    tagline: 'Recordings that survive stalls and reboots',
    stack: ['Node.js', 'TypeScript', 'FFmpeg', 'SQLite', 'Angular', 'Docker'],
    problem:
      'Recording live television is a long-running process that fails in ordinary ways: a stream stalls, a provider rotates its token URL, a server restarts mid-episode. A failure should leave a playable file and a clear reason, not zero bytes.',
    constraints:
      'Streams are third-party and unreliable, FFmpeg exit codes are ambiguous, and guide data arrives asynchronously from several sources.',
    decision:
      'Capture each recording in .part segments under an FFmpeg process the service supervises, classify failures to retry only the transient ones, and join the segments into one MP4 at finalization; on boot, stitch any interrupted recording’s existing parts. Stream URLs are resolved from the database when a recording starts.',
    rationale:
      'Segmenting turns a mid-recording failure into a recoverable partial file rather than a lost recording.',
    tradeoffs:
      'Recovery produces partial recordings with a gap rather than seamless ones, and finalization costs an extra concat pass.',
    evidence:
      'Unit tests cover retry classification and backoff, DVR lifecycle policy, recording storage, atomic writes, job queue and series rules; Playwright suites include reliability and stream-stability tests, and the release workflow reruns unit and e2e before publishing a pinned image.',
    status:
      'Released v0.6.1 · GHCR image via release workflow, debug-signed Android mobile/TV APKs · recovery behaviour per source and tests, not field-measured',
    repoHref: 'https://github.com/cjrutherford/epg-manager',
    releaseHref:
      'https://github.com/cjrutherford/epg-manager/releases/tag/v0.6.1',
    featured: false,
    initials: 'TD',
    imageSrc: 'assets/images/case-studies/tuner-daemon-guide.webp',
    imageAlt: 'TunerDaemon live guide and player interface',
    tone: 'media',
  },
];
