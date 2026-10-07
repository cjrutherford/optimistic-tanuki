import { AssessmentAnswers, buildAssessmentMessage } from './assessment';

describe('buildAssessmentMessage', () => {
  const answers: AssessmentAnswers = {
    audience: 'organization',
    organization: ' Grace Community ',
    name: 'Ada',
    email: 'ada@example.com',
    phone: '',
    people: '6-20',
    keep: ['files', 'passwords'],
    storage: '0.5-2tb',
    currentSpend: 'Google Workspace, 12 seats',
    notes: '  We meet twice a week.  ',
  };

  it('writes each answer as a readable line', () => {
    expect(buildAssessmentMessage(answers)).toBe(
      [
        'Private cloud assessment',
        '',
        'For: Organization',
        'Organization: Grace Community',
        'People using it: 6 to 20 people',
        'Wants to keep: Files and shared folders, Passwords',
        'Roughly how much: 500 GB to 2 TB',
        'Current subscriptions: Google Workspace, 12 seats',
        '',
        'Notes:',
        'We meet twice a week.',
      ].join('\n')
    );
  });

  it('marks unanswered optional questions and omits the organization for homes', () => {
    const message = buildAssessmentMessage({
      ...answers,
      audience: 'home',
      keep: [],
      currentSpend: '',
      notes: '',
    });

    expect(message).toContain('For: Home');
    expect(message).not.toContain('Organization:');
    expect(message).toContain('Wants to keep: Not answered');
    expect(message).toContain('Current subscriptions: Not answered');
    expect(message).not.toContain('Notes:');
  });

  it('always meets the intake minimum message length', () => {
    expect(
      buildAssessmentMessage({
        ...answers,
        keep: [],
        currentSpend: '',
        notes: '',
      }).length
    ).toBeGreaterThanOrEqual(10);
  });
});
