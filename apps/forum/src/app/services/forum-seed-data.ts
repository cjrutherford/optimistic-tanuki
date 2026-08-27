export type ForumSeedTopic = {
  appScope: 'client-interface' | 'forgeofwill';
  title: string;
  description: string;
};

export const FORUM_SEED_TOPICS: readonly ForumSeedTopic[] = [
  {
    appScope: 'client-interface',
    title: 'Community Introductions',
    description:
      'Meet other members, share what you are working on, and find welcoming conversations to join.',
  },
  {
    appScope: 'client-interface',
    title: 'Local Ideas and Coordination',
    description:
      'Coordinate neighborhood activities, shared resources, and practical local improvements.',
  },
  {
    appScope: 'forgeofwill',
    title: 'Project Execution',
    description:
      'Discuss planning workflows, task breakdowns, and habits that help projects move forward.',
  },
  {
    appScope: 'forgeofwill',
    title: 'Risks, Decisions, and Lessons Learned',
    description:
      'Share project risks, decision notes, and lessons that can make future work more resilient.',
  },
];

export const FORUM_PRODUCTION_TOPICS: readonly ForumSeedTopic[] = [
  {
    appScope: 'client-interface',
    title: 'Community Conversations',
    description:
      'A welcoming place for thoughtful discussions, introductions, and shared community knowledge.',
  },
  {
    appScope: 'client-interface',
    title: 'Local Coordination',
    description:
      'Coordinate local activities, shared resources, and practical improvements with other members.',
  },
  {
    appScope: 'forgeofwill',
    title: 'Project Planning and Execution',
    description:
      'Discuss planning approaches, execution habits, and ways to keep important work moving.',
  },
  {
    appScope: 'forgeofwill',
    title: 'Risks and Decisions',
    description:
      'Capture project risks, decision context, and lessons that help teams work with confidence.',
  },
];
