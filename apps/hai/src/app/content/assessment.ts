/** Questions for the private-cloud assessment (S013). */

export type AssessmentAudience = 'home' | 'organization';

export interface AssessmentOption {
  value: string;
  label: string;
}

export const ASSESSMENT_PEOPLE: AssessmentOption[] = [
  { value: '1-5', label: '1 to 5 people' },
  { value: '6-20', label: '6 to 20 people' },
  { value: '21-50', label: '21 to 50 people' },
  { value: '50+', label: 'More than 50 people' },
];

export const ASSESSMENT_KEEP: AssessmentOption[] = [
  { value: 'files', label: 'Files and shared folders' },
  { value: 'photos', label: 'Photos and videos' },
  { value: 'media', label: 'Movies, shows, or music' },
  { value: 'documents', label: 'Scanned paperwork' },
  { value: 'passwords', label: 'Passwords' },
  { value: 'backups', label: 'Backups of computers and phones' },
];

export const ASSESSMENT_STORAGE: AssessmentOption[] = [
  { value: 'under-500gb', label: 'Less than 500 GB' },
  { value: '0.5-2tb', label: '500 GB to 2 TB' },
  { value: '2-8tb', label: '2 TB to 8 TB' },
  { value: 'over-8tb', label: 'More than 8 TB' },
  { value: 'not-sure', label: 'Not sure' },
];

export const ASSESSMENT_NEXT_STEPS: string[] = [
  'We read your answers and reply by email, usually with a few questions.',
  'You get an itemized quote: each part at its actual cost, and the labor hours we expect.',
  'Nothing is ordered or installed until you say yes.',
];

export interface AssessmentAnswers {
  audience: AssessmentAudience;
  organization: string;
  name: string;
  email: string;
  phone: string;
  people: string;
  keep: string[];
  storage: string;
  currentSpend: string;
  notes: string;
}

const label = (options: AssessmentOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? 'Not answered';

/** Turns the answers into the plain-text message the contact intake stores. */
export function buildAssessmentMessage(answers: AssessmentAnswers): string {
  const keep = answers.keep.length
    ? answers.keep.map((value) => label(ASSESSMENT_KEEP, value)).join(', ')
    : 'Not answered';
  const lines = [
    'Private cloud assessment',
    '',
    `For: ${answers.audience === 'home' ? 'Home' : 'Organization'}`,
    ...(answers.audience === 'organization' && answers.organization.trim()
      ? [`Organization: ${answers.organization.trim()}`]
      : []),
    `People using it: ${label(ASSESSMENT_PEOPLE, answers.people)}`,
    `Wants to keep: ${keep}`,
    `Roughly how much: ${label(ASSESSMENT_STORAGE, answers.storage)}`,
    `Current subscriptions: ${answers.currentSpend.trim() || 'Not answered'}`,
  ];
  if (answers.notes.trim()) {
    lines.push('', 'Notes:', answers.notes.trim());
  }
  return lines.join('\n');
}
