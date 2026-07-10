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
                  sourcePath: 'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'cpp',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'rust',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/functions-and-scope.md',
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
                  sourcePath: 'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'go',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'cpp',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/functions-and-scope.md',
                },
                {
                  languageId: 'rust',
                  strategy: 'fenced-blocks',
                  sourcePath: 'content/programming-basics/functions-and-scope.md',
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

type TutorialLanguageId = 'typescript' | 'go' | 'cpp' | 'rust';

interface TutorialLesson {
  slug: string;
  title: string;
  sourcePath: string;
}

interface TutorialModule {
  id: string;
  title: string;
  lessons: TutorialLesson[];
}

interface TutorialCurriculum {
  id: string;
  displayName: string;
  languageId: TutorialLanguageId;
  modules: TutorialModule[];
}

const lessons = (
  modulePath: string,
  definitions: readonly [slug: string, title: string][]
): TutorialLesson[] =>
  definitions.map(([slug, title], index) => ({
    slug,
    title,
    sourcePath: `src/content/modules/${modulePath}/${String(index + 1).padStart(
      2,
      '0'
    )}-${slug}.md`,
  }));

const goBasicsSubLessons: TutorialLesson[] = [
  ['02a-basic-types', 'basic-types', 'Basic Types'],
  ['02b-type-conversion', 'type-conversion', 'Type Conversion'],
  ['02c-custom-types', 'custom-types', 'Custom Types'],
  [
    '03a-function-declarations',
    'function-declarations',
    'Function Declarations',
  ],
  ['03b-multiple-returns', 'multiple-returns', 'Multiple Returns'],
  ['03c-variadic-functions', 'variadic-functions', 'Variadic Functions'],
  ['04a-if-else', 'if-else', 'If/Else'],
  ['04b-switch-statements', 'switch-statements', 'Switch Statements'],
  ['04c-loops', 'loops', 'Loops'],
  ['05a-package-declaration', 'package-declaration', 'Package Declaration'],
  ['05b-import-statements', 'import-statements', 'Import Statements'],
  ['05c-init-functions', 'init-functions', 'init Functions'],
].map(([fileName, slug, title]) => ({
  slug,
  title,
  sourcePath: `src/content/modules/basics/${fileName}.md`,
}));

const tutorialCurricula: TutorialCurriculum[] = [
  {
    id: 'typescript-foundations',
    displayName: 'TypeScript',
    languageId: 'typescript',
    modules: [
      {
        id: 'basics',
        title: 'TypeScript Basics',
        lessons: lessons('basics', [
          ['hello-world', 'Hello World'],
          ['variables-types', 'Variables & Types'],
          ['functions', 'Functions'],
          ['control-flow', 'Control Flow'],
          ['modules-imports', 'Modules & Imports'],
        ]),
      },
      {
        id: 'javascript-to-typescript',
        title: 'JS to TypeScript',
        lessons: lessons('javascript-to-typescript', [
          ['adding-types', 'Adding Types to JS'],
          ['type-inference', 'Type Inference'],
          ['migration-patterns', 'Migration Patterns'],
        ]),
      },
      {
        id: 'type-system',
        title: 'Type System',
        lessons: lessons('type-system', [
          ['interfaces-vs-types', 'Interfaces vs Types'],
          ['union-intersection', 'Union & Intersection'],
          ['generics', 'Generics'],
        ]),
      },
      {
        id: 'advanced-types',
        title: 'Advanced Types',
        lessons: lessons('advanced-types', [
          ['conditional-types', 'Conditional Types'],
          ['mapped-types', 'Mapped & Template Types'],
          ['utility-types', 'Utility Types'],
        ]),
      },
      {
        id: 'async',
        title: 'Async TypeScript',
        lessons: lessons('async', [
          ['promises', 'Promises'],
          ['async-await', 'Async/Await'],
          ['concurrent-patterns', 'Concurrent Patterns'],
        ]),
      },
      {
        id: 'modules',
        title: 'Modules & Packages',
        lessons: lessons('modules', [
          ['es-modules', 'ES Modules'],
          ['declaration-files', 'Declaration Files'],
          ['module-resolution', 'Module Resolution'],
        ]),
      },
      {
        id: 'testing',
        title: 'Testing',
        lessons: lessons('testing', [
          ['vitest-basics', 'Vitest Basics'],
          ['type-safe-testing', 'Type-Safe Testing'],
          ['mocking', 'Mocking'],
        ]),
      },
      {
        id: 'frontend',
        title: 'Frontend with React',
        lessons: lessons('frontend', [
          ['react-typescript', 'React + TypeScript'],
          ['hooks-typing', 'Typing Hooks'],
          ['component-patterns', 'Component Patterns'],
        ]),
      },
      {
        id: 'angular',
        title: 'Frontend with Angular',
        lessons: lessons('angular', [
          ['angular-components', 'Angular Components'],
          ['angular-services-di', 'Services & DI'],
          ['angular-forms-routing', 'Forms & Routing'],
        ]),
      },
      {
        id: 'backend',
        title: 'Backend with Node.js',
        lessons: lessons('backend', [
          ['nodejs-typescript', 'Node.js + TypeScript'],
          ['express-typescript', 'Express + TypeScript'],
          ['rest-apis', 'REST APIs'],
        ]),
      },
      {
        id: 'packages',
        title: 'Popular Packages',
        lessons: lessons('packages', [
          ['zod-validation', 'Zod Validation'],
          ['prisma-orm', 'Prisma ORM'],
          ['popular-libraries', 'Popular Libraries'],
        ]),
      },
      {
        id: 'polish',
        title: 'Polish & Deploy',
        lessons: lessons('polish', [
          ['tsconfig-deep-dive', 'tsconfig Deep Dive'],
          ['strict-mode', 'Strict Mode'],
          ['deployment', 'Deployment'],
        ]),
      },
    ],
  },
  {
    id: 'go-foundations',
    displayName: 'Go',
    languageId: 'go',
    modules: [
      {
        id: 'basics',
        title: 'Go Basics',
        lessons: lessons('basics', [
          ['hello-world', 'Hello World'],
          ['variables-types', 'Variables & Types'],
          ['functions', 'Functions'],
          ['control-flow', 'Control Flow'],
          ['packages-imports', 'Packages & Imports'],
        ]).concat(goBasicsSubLessons),
      },
      {
        id: 'typescript-to-go',
        title: 'TypeScript to Go',
        lessons: lessons('typescript-to-go', [
          ['type-system-comparison', 'Type System Comparison'],
          ['zero-values', 'Zero Values'],
          ['error-handling', 'Error Handling'],
        ]),
      },
      {
        id: 'quirks',
        title: "Go's Unique Quirks",
        lessons: lessons('quirks', [
          ['values-vs-pointers', 'Values vs Pointers'],
          ['slices-arrays-maps', 'Slices, Arrays & Maps'],
          ['defer-panic-recover', 'defer, panic & recover'],
        ]),
      },
      {
        id: 'gc',
        title: 'Garbage Collection',
        lessons: lessons('gc', [
          ['how-gc-works', 'How GC Works'],
          ['escape-analysis', 'Escape Analysis'],
          ['gc-friendly-code', 'GC-Friendly Code'],
        ]),
      },
      {
        id: 'concurrency',
        title: 'Concurrency',
        lessons: lessons('concurrency', [
          ['goroutines-101', 'Goroutines 101'],
          ['channels', 'Channels'],
          ['select-statement', 'select Statement'],
        ]),
      },
      {
        id: 'parallelism',
        title: 'Parallelism',
        lessons: lessons('parallelism', [
          ['waitgroup-mutex', 'WaitGroup & Mutex'],
          ['sync-atomic', 'sync/atomic'],
          ['race-conditions', 'Race Conditions'],
        ]),
      },
      {
        id: 'testing',
        title: 'Testing in Go',
        lessons: lessons('testing', [
          ['testing-package', 'The testing Package'],
          ['table-tests', 'Table-Driven Tests'],
          ['benchmarks', 'Benchmarks'],
        ]),
      },
      {
        id: 'webservices',
        title: 'Web Services',
        lessons: lessons('webservices', [
          ['net-http-basics', 'net/http Basics'],
          ['rest-apis', 'REST APIs'],
          ['middleware', 'Middleware'],
        ]),
      },
      {
        id: 'stdlib',
        title: 'Standard Library',
        lessons: lessons('stdlib', [
          ['fmt-strings-strconv', 'fmt, strings & strconv'],
          ['encoding-packages', 'Encoding Packages'],
          ['net-http-context', 'net/http & context'],
        ]),
      },
      {
        id: 'packages',
        title: 'Popular Packages',
        lessons: lessons('packages', [
          ['web-frameworks', 'Web Frameworks'],
          ['orms-db', 'ORMs & Databases'],
          ['utilities', 'Utilities'],
        ]),
      },
      {
        id: 'polish',
        title: 'Production Polish',
        lessons: lessons('polish', [
          ['profiling', 'Profiling'],
          ['security', 'Security'],
          ['deployment', 'Deployment'],
        ]),
      },
    ],
  },
  {
    id: 'cpp-foundations',
    displayName: 'C++',
    languageId: 'cpp',
    modules: [
      {
        id: 'basics',
        title: 'C++ Basics',
        lessons: lessons('basics', [
          ['hello-world', 'Hello World'],
          ['variables-types', 'Variables & Types'],
          ['functions', 'Functions'],
          ['control-flow', 'Control Flow'],
          ['pointers-references', 'Pointers & References'],
        ]),
      },
      {
        id: 'oop',
        title: 'Object-Oriented Programming',
        lessons: lessons('oop', [
          ['classes-objects', 'Classes & Objects'],
          ['inheritance', 'Inheritance'],
          ['polymorphism', 'Polymorphism'],
        ]),
      },
      {
        id: 'memory',
        title: 'Memory Management',
        lessons: lessons('memory', [
          ['stack-heap', 'Stack vs Heap'],
          ['smart-pointers', 'Smart Pointers'],
          ['raii', 'RAII'],
        ]),
      },
      {
        id: 'stl',
        title: 'Standard Template Library',
        lessons: lessons('stl', [
          ['containers', 'Containers'],
          ['algorithms', 'Algorithms'],
          ['iterators', 'Iterators'],
        ]),
      },
      {
        id: 'templates',
        title: 'Templates',
        lessons: lessons('templates', [
          ['function-templates', 'Function Templates'],
          ['class-templates', 'Class Templates'],
          ['template-specialization', 'Template Specialization'],
        ]),
      },
      {
        id: 'modern-cpp',
        title: 'Modern C++',
        lessons: lessons('modern-cpp', [
          ['auto-lambdas', 'auto & Lambdas'],
          ['move-semantics', 'Move Semantics'],
          ['concurrency', 'Concurrency'],
        ]),
      },
      {
        id: 'testing',
        title: 'Testing with Catch2',
        lessons: lessons('testing', [
          ['catch2-basics', 'Catch2 Basics'],
          ['test-cases', 'Test Cases & Sections'],
          ['assertions', 'Assertions & Matchers'],
        ]),
      },
    ],
  },
  {
    id: 'rust-foundations',
    displayName: 'Rust',
    languageId: 'rust',
    modules: [
      {
        id: 'basics',
        title: 'Rust Basics',
        lessons: lessons('basics', [
          ['hello-world', 'Hello World'],
          ['variables-types', 'Variables & Types'],
          ['functions', 'Functions'],
          ['control-flow', 'Control Flow'],
        ]),
      },
      {
        id: 'ownership',
        title: 'Ownership',
        lessons: lessons('ownership', [
          ['ownership-rules', 'Ownership Rules'],
          ['borrowing', 'Borrowing & References'],
        ]),
      },
      {
        id: 'structs',
        title: 'Structs & Enums',
        lessons: lessons('structs', [
          ['structs', 'Structs'],
          ['enums', 'Enums'],
          ['pattern-matching', 'Pattern Matching'],
        ]),
      },
      {
        id: 'error-handling',
        title: 'Error Handling',
        lessons: lessons('error-handling', [
          ['result-option', 'Result & Option'],
          ['propagating-errors', 'Propagating Errors'],
        ]),
      },
      {
        id: 'traits',
        title: 'Traits & Generics',
        lessons: lessons('traits', [
          ['traits', 'Traits'],
          ['generics', 'Generics'],
        ]),
      },
      {
        id: 'lifetimes',
        title: 'Lifetimes',
        lessons: [
          {
            slug: 'lifetimes',
            title: 'Lifetimes',
            sourcePath: 'src/content/modules/ownership/03-lifetimes.md',
          },
        ],
      },
      {
        id: 'collections',
        title: 'Collections',
        lessons: lessons('collections', [
          ['vectors', 'Vectors'],
          ['hashmaps', 'HashMaps'],
          ['iterators', 'Iterators'],
        ]),
      },
      {
        id: 'concurrency',
        title: 'Concurrency',
        lessons: lessons('concurrency', [
          ['threads', 'Threads'],
          ['channels', 'Channels'],
          ['shared-state', 'Shared State'],
        ]),
      },
      {
        id: 'testing',
        title: 'Testing in Rust',
        lessons: lessons('testing', [
          ['unit-tests', 'Unit Tests'],
          ['integration-tests', 'Integration Tests'],
          ['test-driven-dev', 'Test-Driven Development'],
        ]),
      },
    ],
  },
];

function tutorialProgramTrack({
  id,
  displayName,
  languageId,
  modules,
}: TutorialCurriculum): ProgramTrack {
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
        modules: modules.map((module) => ({
          id: `${id}-${module.id}`,
          title: module.title,
          lessons: module.lessons.map((lesson) => ({
            id: `${id}-${module.id}-${lesson.slug}`,
            title: lesson.title,
            slug: lesson.slug,
            languageVariants: [
              {
                languageId,
                strategy: 'file-variant',
                sourcePath: lesson.sourcePath,
              },
            ],
          })),
        })),
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

export const tutorialProgramTracks: ProgramTrack[] =
  tutorialCurricula.map(tutorialProgramTrack);

export const sampleProgramTracks: ProgramTrack[] = [
  sampleProgramTrack,
  programmingBasicsProgramTrack,
  ...tutorialProgramTracks,
];
