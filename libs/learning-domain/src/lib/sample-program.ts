import { ProgramTrack } from './learning-domain';

export const sampleProgramTrack: ProgramTrack = {
  id: 'systems-foundations',
  displayName: 'Systems Foundations',
  subjectIds: ['systems', 'software-engineering'],
  supportedLanguageIds: ['go', 'typescript'],
  focuses: [
    {
      id: 'distributed-systems',
      displayName: 'Distributed Systems',
      subjectIds: ['systems', 'software-engineering'],
    },
  ],
  offerings: [
    {
      id: 'systems-100-core',
      type: 'course',
      displayName: 'Systems Core 100',
      subjectId: 'systems',
      level: 100,
      credits: 3,
      outcomeTags: ['foundations', 'problem-solving'],
      modules: [
        {
          id: 'intro-to-systems',
          title: 'Intro to Systems Thinking',
          lessons: [
            {
              id: 'state-and-side-effects',
              title: 'State and Side Effects',
              slug: 'state-and-side-effects',
              languageVariants: [
                {
                  languageId: 'go',
                  strategy: 'file-variant',
                  sourcePath:
                    'content/systems-foundations/intro/state-and-side-effects.go.md',
                },
                {
                  languageId: 'typescript',
                  strategy: 'file-variant',
                  sourcePath:
                    'content/systems-foundations/intro/state-and-side-effects.ts.md',
                },
              ],
            },
          ],
        },
      ],
      activities: [
        {
          type: 'code.run',
          id: 'systems-100-code-activity',
          prompt: 'Implement a pure function and print the result.',
          starterCode: 'function solve() {}',
          expectedOutput: 'ok',
        },
        {
          type: 'quiz.mcq',
          id: 'systems-100-quiz',
          prompt: 'Which property best describes referential transparency?',
          options: [
            { id: 'a', text: 'Same input yields same output' },
            { id: 'b', text: 'Any side effect is acceptable' },
          ],
          correctOptionIds: ['a'],
        },
      ],
    },
    {
      id: 'systems-200-elective-testing',
      type: 'course',
      displayName: 'Systems Testing Elective',
      subjectId: 'software-engineering',
      level: 200,
      credits: 3,
      outcomeTags: ['testing', 'reliability'],
      modules: [
        {
          id: 'testing-mod',
          title: 'Testing for Reliability',
          lessons: [
            {
              id: 'property-tests',
              title: 'Property Testing',
              slug: 'property-testing',
              languageVariants: [
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/systems-foundations/testing/property-testing.md',
                },
                {
                  languageId: 'typescript',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/systems-foundations/testing/property-testing.md',
                },
              ],
            },
          ],
        },
      ],
      activities: [
        {
          type: 'writing.response',
          id: 'systems-200-writing',
          prompt: 'Explain your reliability strategy for a retryable worker.',
          maxWords: 500,
        },
      ],
      prerequisiteOfferingIds: ['systems-100-core'],
    },
    {
      id: 'systems-200-capstone-project',
      type: 'project',
      displayName: 'Distributed Task Runner Project',
      subjectId: 'systems',
      level: 200,
      credits: 4,
      outcomeTags: ['capstone', 'architecture'],
      modules: [
        {
          id: 'capstone',
          title: 'Capstone',
          lessons: [
            {
              id: 'capstone-brief',
              title: 'Project Brief',
              slug: 'project-brief',
              languageVariants: [
                {
                  languageId: 'go',
                  strategy: 'file-variant',
                  sourcePath:
                    'content/systems-foundations/capstone/project-brief.go.md',
                },
                {
                  languageId: 'typescript',
                  strategy: 'file-variant',
                  sourcePath:
                    'content/systems-foundations/capstone/project-brief.ts.md',
                },
              ],
            },
          ],
        },
      ],
      activities: [
        {
          type: 'project.submission',
          id: 'systems-capstone-submission',
          prompt: 'Submit architecture document and implementation repository URL.',
          artifactTypes: ['repo-url', 'architecture-doc'],
        },
      ],
      prerequisiteOfferingIds: ['systems-100-core'],
      unlockRules: [
        {
          id: 'elective-one-of-one',
          requirement: {
            id: 'capstone-unlock-group',
            operator: 'OR',
            minRequired: 1,
            children: [
              {
                kind: 'offering',
                offeringId: 'systems-200-elective-testing',
              },
            ],
          },
        },
      ],
    },
  ],
  requirements: {
    id: 'systems-foundations-degree-plan',
    operator: 'OR',
    minRequired: 2,
    children: [
      { kind: 'offering', offeringId: 'systems-100-core' },
      { kind: 'offering', offeringId: 'systems-200-elective-testing' },
      { kind: 'offering', offeringId: 'systems-200-capstone-project' },
    ],
  },
};
