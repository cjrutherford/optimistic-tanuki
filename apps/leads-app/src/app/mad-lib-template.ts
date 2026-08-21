import { MadLibTemplate } from '@optimistic-tanuki/models';

/**
 * The default intro scaffold.
 *
 * This lives in the app rather than in `libs/models` on purpose: it is a
 * runtime value, and importing one from the models barrel pulls the whole
 * barrel in at runtime — TypeORM entities included — which breaks any browser
 * bundle or jsdom test that touches it. The barrel stays type-only for the
 * frontend, and types are erased at compile time.
 */
export const DEFAULT_MAD_LIB_TEMPLATE: MadLibTemplate = {
  id: 'lead-intro-v1',
  segments: [
    // Opens with who the person is, not only what they do for others. This app
    // finds roles as well as clients, and "I help…" alone frames every user as
    // a consultant pitching a service.
    { kind: 'text', text: 'I am a' },
    {
      kind: 'slot',
      field: 'professionalTitle',
      slotType: 'inline',
      label: 'Your title',
      placeholder: 'Senior Platform Engineer',
    },
    { kind: 'text', text: 'who helps' },
    {
      kind: 'slot',
      field: 'idealCustomer',
      slotType: 'inline',
      label: 'Ideal customer',
      placeholder: 'VP Engineering at mid-size SaaS companies',
    },
    { kind: 'text', text: 'in' },
    {
      kind: 'slot',
      field: 'industries',
      slotType: 'list',
      label: 'Industries',
      placeholder: 'Add an industry',
      options: [
        'SaaS',
        'Healthcare',
        'Finance',
        'Ecommerce',
        'Education',
        'Manufacturing',
        'Marketing',
      ],
    },
    { kind: 'text', text: 'solve' },
    {
      kind: 'slot',
      field: 'problemsSolved',
      slotType: 'list',
      label: 'Problems solved',
      placeholder: 'Add a problem you solve',
    },
    { kind: 'text', text: 'by delivering' },
    {
      kind: 'slot',
      field: 'serviceOffer',
      slotType: 'list',
      label: 'Service offer',
      placeholder: 'Add something you deliver',
    },
    { kind: 'text', text: 'so they get' },
    {
      kind: 'slot',
      field: 'outcomes',
      slotType: 'list',
      label: 'Outcomes',
      placeholder: 'Add an outcome',
    },
    { kind: 'text', text: '.' },
    { kind: 'text', text: 'I do that using' },
    {
      kind: 'slot',
      field: 'skills',
      slotType: 'list',
      label: 'Skills',
      placeholder: 'Add a skill',
    },
    { kind: 'text', text: '.' },
    { kind: 'text', text: 'I work with' },
    {
      kind: 'slot',
      field: 'companySizeTarget',
      slotType: 'list',
      label: 'Company sizes',
      placeholder: 'Add a company size',
      options: ['1-10', '11-50', '51-200', '201-500', '500+'],
      optional: true,
    },
    { kind: 'text', text: 'companies across' },
    {
      kind: 'slot',
      field: 'geographicFocus',
      slotType: 'choice',
      label: 'Geographic focus',
      placeholder: 'Choose a focus',
      options: [
        'Global',
        'North America',
        'US only',
        'Europe',
        'Specific regions',
      ],
    },
    { kind: 'text', text: '.' },
    { kind: 'text', text: 'I reach them through' },
    {
      kind: 'slot',
      field: 'outreachMethod',
      slotType: 'checkset',
      label: 'Outreach methods',
      placeholder: 'Pick the ways you make contact',
      options: [
        'Email',
        'LinkedIn',
        'Phone',
        'Text message',
        'Video call',
        'Cold calls',
        'Networking events',
        'Content marketing',
        'Referrals',
      ],
    },
    { kind: 'text', text: '.' },
    { kind: 'text', text: 'My communication style is' },
    {
      kind: 'slot',
      field: 'communicationStyle',
      slotType: 'choice',
      label: 'Communication style',
      placeholder: 'Choose a style',
      options: ['Formal', 'Casual', 'Technical', 'Story-driven', 'Direct'],
      optional: true,
    },
    { kind: 'text', text: '.' },
  ],
};
