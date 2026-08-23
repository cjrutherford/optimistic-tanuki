/**
 * Invented tracks used for demos and tests.
 *
 * These are NOT the letsgo curricula. Their `sourcePath`s point at content
 * that was never written, so nothing here will render a lesson. The real
 * catalog lives in tutorial-catalog.ts.
 */
import { ProgramTrack } from './learning-domain';
import { tutorialProgramTracks } from './tutorial-catalog';

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
          prompt:
            'Submit architecture document and implementation repository URL.',
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

export const programmingBasicsProgramTrack: ProgramTrack = {
  id: 'programming-basics',
  displayName: 'Programming Basics',
  subjectIds: ['programming', 'computer-science'],
  supportedLanguageIds: ['typescript', 'go', 'cpp', 'rust'],
  focuses: [
    {
      id: 'programming-basics-foundations',
      displayName: 'Programming Foundations',
      subjectIds: ['programming', 'computer-science'],
    },
  ],
  offerings: [
    {
      id: 'programming-basics-100-core',
      type: 'course',
      displayName: 'Programming Basics',
      subjectId: 'programming',
      level: 100,
      credits: 3,
      outcomeTags: [
        'functions',
        'scope',
        'execution-context',
        'runtimes',
        'garbage-collection',
        'memory-management',
        'algorithms',
      ],
      modules: [
        {
          id: 'programming-basics-functions-and-scope',
          title: 'Functions and Scope',
          lessons: [
            {
              id: 'programming-basics-functions-and-scope-functions',
              title: 'Functions',
              slug: 'functions',
              languageVariants: [
                {
                  languageId: 'typescript',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'cpp',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'rust',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/programming-basics/functions-and-scope.md',
                },
              ],
            },
            {
              id: 'programming-basics-functions-and-scope-scope',
              title: 'Scope and Variable Lifetime',
              slug: 'scope-and-variable-lifetime',
              languageVariants: [
                {
                  languageId: 'typescript',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'cpp',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'rust',
                  strategy: 'fenced-blocks',
                  sourcePath:
                    'content/programming-basics/functions-and-scope.md',
                },
              ],
            },
          ],
        },
        {
          id: 'programming-basics-execution',
          title: 'Execution Contexts and Runtimes',
          lessons: [
            {
              id: 'programming-basics-execution-contexts',
              title: 'Execution Contexts',
              slug: 'execution-contexts',
              languageVariants: [
                {
                  languageId: 'typescript',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/execution.md',
                },
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/execution.md',
                },
                {
                  languageId: 'cpp',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/execution.md',
                },
                {
                  languageId: 'rust',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/execution.md',
                },
              ],
            },
            {
              id: 'programming-basics-runtimes',
              title: 'Language Runtimes',
              slug: 'language-runtimes',
              languageVariants: [
                {
                  languageId: 'typescript',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/execution.md',
                },
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/execution.md',
                },
                {
                  languageId: 'cpp',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/execution.md',
                },
                {
                  languageId: 'rust',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/execution.md',
                },
              ],
            },
          ],
        },
        {
          id: 'programming-basics-memory',
          title: 'Memory Management',
          lessons: [
            {
              id: 'programming-basics-memory-management',
              title: 'Memory Management',
              slug: 'memory-management',
              languageVariants: [
                {
                  languageId: 'typescript',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/memory-management.md',
                },
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/memory-management.md',
                },
                {
                  languageId: 'cpp',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/memory-management.md',
                },
                {
                  languageId: 'rust',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/memory-management.md',
                },
              ],
            },
            {
              id: 'programming-basics-garbage-collection',
              title: 'Garbage Collection',
              slug: 'garbage-collection',
              languageVariants: [
                {
                  languageId: 'typescript',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/memory-management.md',
                },
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/memory-management.md',
                },
                {
                  languageId: 'cpp',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/memory-management.md',
                },
                {
                  languageId: 'rust',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/memory-management.md',
                },
              ],
            },
          ],
        },
        {
          id: 'programming-basics-algorithms',
          title: 'Algorithms',
          lessons: [
            {
              id: 'programming-basics-algorithms',
              title: 'Algorithms and Complexity',
              slug: 'algorithms-and-complexity',
              languageVariants: [
                {
                  languageId: 'typescript',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/algorithms.md',
                },
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/algorithms.md',
                },
                {
                  languageId: 'cpp',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/algorithms.md',
                },
                {
                  languageId: 'rust',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/algorithms.md',
                },
              ],
            },
          ],
        },
      ],
      activities: [
        {
          type: 'code.run',
          id: 'programming-basics-implementation',
          prompt:
            'Choose a supported language and implement a function that searches a collection.',
          starterCode: '',
        },
        {
          type: 'quiz.mcq',
          id: 'programming-basics-memory-quiz',
          prompt:
            'Which concept determines how long a variable name can be accessed?',
          options: [
            { id: 'scope', text: 'Scope' },
            { id: 'runtime', text: 'Runtime' },
          ],
          correctOptionIds: ['scope'],
        },
      ],
    },
  ],
  requirements: {
    id: 'programming-basics-requirements',
    operator: 'AND',
    children: [{ kind: 'offering', offeringId: 'programming-basics-100-core' }],
  },
};

/**
 * Everything a test might want to seed: the two invented tracks above plus the
 * real letsgo catalog.
 */
export const sampleProgramTracks: ProgramTrack[] = [
  sampleProgramTrack,
  programmingBasicsProgramTrack,
  ...tutorialProgramTracks,
];
