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

const tutorialSources = {
  typescript: {
    repositoryUrl: 'https://github.com/cjrutherford/letsgots',
    revision: 'fc3f36f8198489ccbf04e5f138dbc9e3eaa97dd8',
    runner: {
      runtime: 'node-tsx',
      maxExecutionSeconds: 10,
      maxMemoryMiB: 256,
      maxProcesses: 32,
      maxOutputBytes: 1_048_576,
      networkEnabled: false,
      readOnlyRootFilesystem: true,
      writableFilesystem: 'scratch-only',
    },
  },
  go: {
    repositoryUrl: 'https://github.com/cjrutherford/letsgogo',
    revision: 'e819cf24e0493f75212a9fb1a8b24a9725fc4660',
    runner: {
      runtime: 'go-wasm',
      maxExecutionSeconds: 10,
      maxMemoryMiB: 256,
      maxProcesses: 32,
      maxOutputBytes: 1_048_576,
      networkEnabled: false,
      readOnlyRootFilesystem: true,
      writableFilesystem: 'scratch-only',
    },
  },
  cpp: {
    repositoryUrl: 'https://github.com/cjrutherford/letsgocpp',
    revision: '4ee199e194a3e9538acd354b7f1400aa6d7a501e',
    runner: {
      runtime: 'g++-cxx17-catch2',
      maxExecutionSeconds: 10,
      maxMemoryMiB: 256,
      maxProcesses: 32,
      maxOutputBytes: 1_048_576,
      networkEnabled: false,
      readOnlyRootFilesystem: true,
      writableFilesystem: 'scratch-only',
    },
  },
  rust: {
    repositoryUrl: 'https://github.com/cjrutherford/letsgorust',
    revision: '9c025dfa08897268881895fce9be0ca697abb6cc',
    runner: {
      runtime: 'rustc-2021',
      maxExecutionSeconds: 10,
      maxMemoryMiB: 256,
      maxProcesses: 32,
      maxOutputBytes: 1_048_576,
      networkEnabled: false,
      readOnlyRootFilesystem: true,
      writableFilesystem: 'scratch-only',
    },
  },
} as const;

function tutorialProgramTrack(
  id: string,
  displayName: string,
  languageId: 'typescript' | 'go' | 'cpp' | 'rust',
  sourcePath: string
): ProgramTrack {
  return {
    id,
    displayName,
    subjectIds: ['programming'],
    supportedLanguageIds: [languageId],
    source: tutorialSources[languageId],
    focuses: [
      {
        id: `${id}-focus`,
        displayName: `${displayName} Foundations`,
        subjectIds: ['programming'],
      },
    ],
    offerings: [
      {
        id: `${id}-100-core`,
        type: 'course',
        displayName: `${displayName} Foundations`,
        subjectId: 'programming',
        level: 100,
        credits: 3,
        outcomeTags: ['foundations', languageId],
        modules: [
          {
            id: `${id}-basics`,
            title: `${displayName} Basics`,
            lessons: [
              {
                id: `${id}-intro`,
                title: `Introduction to ${displayName}`,
                slug: 'introduction',
                languageVariants: [
                  {
                    languageId,
                    strategy: 'file-variant',
                    sourcePath,
                  },
                ],
              },
            ],
          },
        ],
        activities: [
          {
            type: 'code.run',
            id: `${id}-hello-world`,
            prompt: `Write and test a Hello World program in ${displayName}.`,
            starterCode: '',
          },
        ],
      },
    ],
    requirements: {
      id: `${id}-requirements`,
      operator: 'AND',
      children: [{ kind: 'offering', offeringId: `${id}-100-core` }],
    },
  };
}

export const tutorialProgramTracks: ProgramTrack[] = [
  tutorialProgramTrack(
    'typescript-foundations',
    'TypeScript',
    'typescript',
    'src/content/modules/basics'
  ),
  tutorialProgramTrack(
    'go-foundations',
    'Go',
    'go',
    'src/content/modules/basics'
  ),
  tutorialProgramTrack(
    'cpp-foundations',
    'C++',
    'cpp',
    'src/content/modules/basics'
  ),
  tutorialProgramTrack(
    'rust-foundations',
    'Rust',
    'rust',
    'src/content/modules/basics'
  ),
];

export const sampleProgramTracks: ProgramTrack[] = [
  sampleProgramTrack,
  ...tutorialProgramTracks,
];
