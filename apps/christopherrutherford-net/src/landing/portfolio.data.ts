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
    | 'media';
}

export const PORTFOLIO_ENTRIES: PortfolioEntry[] = [
  {
    id: 'optimistic-tanuki',
    summary:
      'A broader social product where messaging, identity, profile, and utility features all have to feel like part of the same system.',
    proof:
      'It shows how I handle feature-rich product surfaces without losing the thread between user experience and platform structure.',
    tone: 'social',
  },
  {
    id: 'towne-square',
    summary:
      'Community software for neighborhood conversation, local listings, classifieds, and discovery in one place.',
    proof:
      'It is a good example of work where community, marketplace, and local context all need to coexist without the product feeling scattered.',
    tone: 'civic',
  },
  {
    id: 'forge-of-will',
    summary:
      'A planning tool for people who want more structure than a task list but less noise than a full productivity suite.',
    proof:
      'The interesting part here is the workflow design: how the product helps people think, not just what buttons it gives them.',
    tone: 'planning',
  },
  {
    id: 'fin-commander',
    summary:
      'A personal finance app focused on accounts, transactions, imports, and planning without turning everyday money management into enterprise software.',
    proof:
      'It shows the kind of dense, detail-heavy interface work where information architecture has to do most of the heavy lifting.',
    tone: 'finance',
  },
  {
    id: 'opportunity-compass',
    summary:
      'A discovery app that turns interests, skills, and local context into leads, prospects, and next-step opportunities.',
    proof:
      'This is the kind of guided intake and decision-support work where the value comes from shaping messy inputs into something usable.',
    tone: 'discovery',
  },
  {
    id: 'developer-portal',
    summary:
      'A developer portal meant to help people understand a platform quickly instead of making them hunt through scattered docs and setup steps.',
    proof:
      'It reflects the kind of DX work where clarity, onboarding, and product framing matter just as much as technical correctness.',
    tone: 'developer',
  },
  {
    id: 'store-client',
    summary:
      'A commerce shell for bookings, purchases, donations, and the kinds of flows where people need to know what they are doing at every step.',
    proof:
      'It is useful proof for transaction-heavy UX, where the customer path needs to feel obvious and the underlying structure still has to stay dependable.',
    tone: 'commerce',
  },
  {
    id: 'video-platform',
    summary:
      'A video product with upload, playback, visibility controls, and the supporting workflows around publishing and viewing media.',
    proof:
      'It shows how I work across creator tooling, audience-facing media flows, and the system concerns that sit behind both.',
    tone: 'media',
  },
];
