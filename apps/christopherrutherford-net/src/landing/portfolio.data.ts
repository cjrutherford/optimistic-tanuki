export interface PortfolioEntry {
  id: string;
  summary: string;
  proof: string;
  tone:
    | 'social'
    | 'civic'
    | 'planning'
    | 'finance'
    | 'discovery'
    | 'developer'
    | 'commerce'
    | 'media'
    | 'business'
    | 'config'
    | 'publishing'
    | 'marketing'
    | 'internal';
}

export const PORTFOLIO_ENTRIES: PortfolioEntry[] = [
  {
    id: 'client-interface',
    summary:
      'A social product that connects community, identity, messaging, profiles, and practical everyday tools.',
    proof:
      'Shows product design across a broad set of related features, keeping familiar interactions coherent as the platform grows.',
    tone: 'social',
  },
  {
    id: 'local-hub',
    summary:
      'Neighborhood conversation, local business listings, classifieds, commerce, and community discovery in one place.',
    proof:
      'Brings civic context and marketplace workflows together without losing a clear path through the product.',
    tone: 'civic',
  },
  {
    id: 'forgeofwill',
    summary:
      'A planning tool for people who want structure around projects, tasks, journals, risks, and decisions.',
    proof:
      'Shows workflow design that helps people understand and shape the work ahead, not only track tasks.',
    tone: 'planning',
  },
  {
    id: 'fin-commander',
    summary:
      'A personal finance app for accounts, transactions, imports, budgets, and scenario planning.',
    proof:
      'Demonstrates dense information architecture that keeps everyday money decisions approachable.',
    tone: 'finance',
  },
  {
    id: 'leads-app',
    summary:
      'A guided discovery app that turns skills, interests, and local context into useful opportunities.',
    proof:
      'Shows how structured intake can turn varied personal context into practical next steps.',
    tone: 'discovery',
  },
  {
    id: 'developer-portal',
    summary:
      'A developer entry point for API orientation, SDK discovery, and getting started with the platform.',
    proof:
      'Brings onboarding and technical discovery into one clear path for developers.',
    tone: 'developer',
  },
  {
    id: 'store-client',
    summary:
      'A commerce experience for storefronts, bookings, donations, and purchases.',
    proof:
      'Shows transaction flows designed to make each step and commitment clear.',
    tone: 'commerce',
  },
  {
    id: 'video-client',
    summary:
      'A media product for publishing, channels, playback, and finding video content.',
    proof:
      'Covers both creator workflows and audience-facing viewing experiences.',
    tone: 'media',
  },
  {
    id: 'business-site',
    summary:
      'Signal Foundry brings business marketing, scheduling, client portal, and owner workflows together.',
    proof:
      'Connects business communication and service workflows in one product surface.',
    tone: 'business',
  },
  {
    id: 'digital-homestead',
    summary:
      'A personal online home for publishing, projects, and community activity.',
    proof: 'Brings ownership and expression into one flexible personal space.',
    tone: 'publishing',
  },
  {
    id: 'system-configurator',
    summary:
      'HAI Computer helps people configure personal cloud and homelab systems.',
    proof:
      'Turns hardware and system choices into a guided configuration journey.',
    tone: 'config',
  },
  {
    id: 'hai',
    summary:
      'The HAI company site and ecosystem entry point for products and services.',
    proof:
      'Shows how a company presence can guide visitors through a wider application ecosystem.',
    tone: 'business',
  },
  {
    id: 'd6',
    summary: 'D6 supports wellness tracking and repeatable daily practices.',
    proof: 'Connects personal tracking with approachable daily routines.',
    tone: 'planning',
  },
  {
    id: 'learning',
    summary: 'A learning app for educational resources and guided workflows.',
    proof:
      'Structures learning content into a focused, approachable experience.',
    tone: 'developer',
  },
  {
    id: 'owner-console',
    summary: 'An internal workspace for registry and platform operations.',
    proof: 'Brings the tools operators need into one focused console.',
    tone: 'internal',
  },
  {
    id: 'configurable-client',
    summary: 'A configurable shell for generated client applications.',
    proof: 'Provides a reusable foundation for tailored web experiences.',
    tone: 'internal',
  },
  {
    id: 'business-configurator',
    summary: 'A builder for configured business website experiences.',
    proof: 'Turns business requirements into a structured site setup workflow.',
    tone: 'internal',
  },
  {
    id: 'ui-playground',
    summary: 'An internal playground for shared components and documentation.',
    proof: 'Supports consistent interface work across the application suite.',
    tone: 'internal',
  },
];
