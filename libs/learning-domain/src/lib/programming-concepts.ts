import { Activity, ProgramTrack } from './learning-domain';

/**
 * Programming Concepts: the spine the four language courses hang from.
 *
 * Each of those teaches one language well and none of them teaches the ideas
 * underneath, so somebody who finishes Go has no framework for reading Rust.
 * They meet `&mut` as a new fact rather than as the same aliased-mutable-state
 * problem they already solved once with pointers.
 *
 * Deliberately language-agnostic, which is why it claims no language and no
 * variant axis. It shows code from all four courses as illustration and points
 * outward to where each idea is worked through properly, but nothing here is
 * submitted to the runner: an exercise about ownership in general has no
 * language to compile.
 */
const modules = [
  {
    id: 'state',
    title: 'State and Mutation',
    lessons: [
      ['binding-vs-value', 'A Name Is Not the Value'],
      ['what-immutable-freezes', 'What "Immutable" Actually Freezes'],
      ['shared-mutable-state', 'The Problem Underneath Everything'],
      ['scope-and-lifetime', 'Scope and Lifetime Are Different Questions'],
    ],
  },
  {
    id: 'types',
    title: 'Types',
    lessons: [
      ['what-a-type-is-for', 'What a Type Is For'],
      ['nominal-vs-structural', 'Same Shape, Different Identity'],
      ['sum-and-product', 'One Of These, or All of These'],
      ['two-polymorphisms', 'Two Different Things Called Polymorphism'],
      ['inference', 'Inferred Is Not Untyped'],
    ],
  },
  {
    id: 'functions',
    title: 'Functions and Composition',
    lessons: [
      ['pure-and-effects', 'When a Signature Tells the Truth'],
      ['first-class', 'Passing Behaviour, Not Just Data'],
      ['closures', 'What a Closure Actually Captures'],
      ['composition', 'Composing Instead of Inheriting'],
    ],
  },
  {
    id: 'iteration',
    title: 'Iteration and Recursion',
    lessons: [
      ['what-a-loop-costs', 'What a Loop Actually Costs'],
      ['recursion', 'Carrying State in the Call Instead'],
      ['tail-calls', 'Why "Recursion Is Just a Loop" Is False Here'],
      ['iterators', 'An Iterator Is Not a List'],
    ],
  },
  {
    id: 'memory',
    title: 'Memory as a Model',
    lessons: [
      ['stack-and-heap', 'A Lifetime Decision, Not a Syntax One'],
      ['value-vs-reference', 'Copying a Value, Copying Access'],
      ['ownership', 'Who Is Responsible for Freeing It'],
      ['aliasing', 'Two Names for the Same Memory'],
      ['collections', 'Collections Are Memory Shapes'],
    ],
  },
  {
    id: 'errors',
    title: 'Failure',
    lessons: [
      ['two-designs', 'Two Designs for "This Failed"'],
      ['the-tradeoff', 'What Each One Costs You'],
      ['expected-vs-exceptional', 'A Missing File and a Mistyped Number'],
      ['absence-vs-failure', 'Nothing Found Is Not the Same as Broken'],
    ],
  },
  {
    id: 'concurrency',
    title: 'Concurrency',
    lessons: [
      ['concurrency-vs-parallelism', 'Interleaved Is Not Simultaneous'],
      ['what-a-race-is', 'What a Race Condition Actually Is'],
      ['sharing-vs-passing', 'Guard It, or Do Not Share It'],
      ['atomicity', 'Why One Line Is Not One Operation'],
    ],
  },
] as const;

const TRACK_ID = 'programming-concepts';
const OFFERING_ID = 'programming-concepts-200-core';

/**
 * The work.
 *
 * No code runner: this course has no language to compile against, which is the
 * point of it. Multiple choice suits the questions with a checkable answer
 * ("which of these contains a race"), and written answers suit the ones where
 * the reasoning is the thing being assessed.
 */
const activities: Activity[] = [
  {
    id: 'pc-state-immutable',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-state-what-immutable-freezes`,
    prompt:
      'A colleague says "I made it const, so it is immutable now." Explain what is and is not actually frozen by that, and name a case where their claim would not hold.',
    maxWords: 250,
    sampleResponse:
      'Const freezes the binding, not the value. The name cannot be pointed at something else, but whatever it already points at can still be changed through it or through any other reference to the same thing. An array declared const can still have items pushed onto it, because pushing does not rebind the name. Deep immutability is a different and stronger property, and it has to come from the value itself rather than from how the name was declared.',
    rubric: {
      id: 'pc-state-rubric',
      title: 'Binding against value',
      criteria: [
        {
          id: 'binding',
          description:
            'Distinguishes freezing the binding, which const does, from freezing the value it refers to, which it does not.',
          maxPoints: 5,
        },
        {
          id: 'example',
          description:
            'Gives a concrete case where a const binding still allows the value to change.',
          maxPoints: 3,
        },
        {
          id: 'deeper',
          description:
            'Notes that deep immutability is a separate property rather than a stronger form of the same one.',
          maxPoints: 2,
        },
      ],
    },
  },
  {
    id: 'pc-types-structural',
    type: 'quiz.mcq',
    lessonId: `${TRACK_ID}-types-nominal-vs-structural`,
    prompt:
      'A type has the methods an interface requires, but never declares that it implements it, and the compiler accepts it anyway. What is that telling you?',
    options: [
      {
        id: 'structural',
        text: 'The interface is satisfied structurally: having the right shape is the whole requirement',
      },
      {
        id: 'inference',
        text: 'The compiler inferred the declaration and inserted it',
      },
      { id: 'dynamic', text: 'The language is dynamically typed' },
      { id: 'duck', text: 'The check has been deferred until runtime' },
    ],
    correctOptionIds: ['structural'],
  },
  {
    id: 'pc-closures-explain',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-functions-closures`,
    prompt:
      'Ten concurrent tasks are started inside a loop, each one printing the loop variable, and they do not print what the author expected. Explain what a closure captures, and why that produces the surprise.',
    maxWords: 250,
    sampleResponse:
      'A closure captures the variable, not the value it held when the closure was made. If every iteration shares one variable, all ten tasks end up looking at the same one, and they read whatever it holds by the time they actually run, which is usually after the loop has finished. The fix is to give each iteration its own variable, either by passing the value as an argument or by declaring a fresh one inside the loop body.',
    rubric: {
      id: 'pc-closures-rubric',
      title: 'Capture',
      criteria: [
        {
          id: 'variable',
          description:
            'Says a closure captures the variable rather than a snapshot of its value.',
          maxPoints: 5,
        },
        {
          id: 'timing',
          description:
            'Connects that to when the tasks actually run, rather than when they were created.',
          maxPoints: 3,
        },
        {
          id: 'fix',
          description: 'Names a fix that gives each iteration its own binding.',
          maxPoints: 2,
        },
      ],
    },
  },
  {
    id: 'pc-tail-calls',
    type: 'quiz.mcq',
    lessonId: `${TRACK_ID}-iteration-tail-calls`,
    prompt:
      'You are told "recursion is just a loop written differently, so depth costs nothing." For which of the four languages this platform teaches is that safe to rely on?',
    options: [
      {
        id: 'none',
        text: 'None of them: none guarantees the optimisation, so deep recursion can still exhaust the stack',
      },
      { id: 'rust', text: 'Rust, because of its ownership model' },
      { id: 'go', text: 'Go, because goroutine stacks grow on demand' },
      { id: 'all', text: 'All of them: every modern compiler does this' },
    ],
    correctOptionIds: ['none'],
  },
  {
    id: 'pc-memory-aliasing',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-memory-aliasing`,
    prompt:
      'A function is passed a collection, appends to it, and the caller does not see the change. Explain what the caller and the function were each holding, and why the change did not cross back.',
    maxWords: 300,
    sampleResponse:
      'Both were holding a value that describes where the elements live, and the function got its own copy of that description. Appending can outgrow the space the elements are in, and when it does the function gets a new place for them and updates its own copy to point there. The caller still holds the old description pointing at the old place, so it sees the old contents. Mutating an existing element would have been visible, because both descriptions still pointed at the same elements; growing was not.',
    rubric: {
      id: 'pc-memory-rubric',
      title: 'Aliasing and reallocation',
      criteria: [
        {
          id: 'copy',
          description:
            'Recognises the function received a copy of a reference-like value, rather than the collection itself or a reference to the caller variable.',
          maxPoints: 4,
        },
        {
          id: 'realloc',
          description:
            'Explains that growing can move the elements, breaking the shared view.',
          maxPoints: 4,
        },
        {
          id: 'contrast',
          description:
            'Notes that mutating an existing element would have been visible, so the difference is growth rather than mutation.',
          maxPoints: 2,
        },
      ],
    },
  },
  {
    id: 'pc-errors-argue',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-errors-the-tradeoff`,
    prompt:
      'Argue for or against: "Forcing the caller to check every error makes code more correct." Engage with the cost of your own position, not only its benefit.',
    maxWords: 350,
    sampleResponse:
      'Mostly for, with a caveat. Making failure part of the return type means the reader can see which calls can fail without leaving the file, and the compiler can complain when one is ignored. The cost is real: the happy path is buried in checking, and ceremony that appears everywhere gets skipped everywhere, so people discard errors just to move on. Exceptions buy a clean happy path and pay for it by letting a failure travel silently past code that had no idea it could arrive.',
    rubric: {
      id: 'pc-errors-rubric',
      title: 'Arguing a trade',
      criteria: [
        {
          id: 'position',
          description: 'Takes a position and states it clearly.',
          maxPoints: 2,
        },
        {
          id: 'cost',
          description:
            'Names a genuine cost of the position taken, rather than only its benefits.',
          maxPoints: 5,
        },
        {
          id: 'mechanism',
          description:
            'Argues from how the two designs actually behave rather than from preference.',
          maxPoints: 3,
        },
      ],
    },
  },
  {
    id: 'pc-race-spot',
    type: 'quiz.mcq',
    lessonId: `${TRACK_ID}-concurrency-what-a-race-is`,
    prompt: 'Which of these is a data race?',
    options: [
      {
        id: 'unguarded-write',
        text: 'Two tasks incrementing the same counter with no synchronisation between them',
      },
      {
        id: 'parallel-disjoint',
        text: 'Two tasks running at the same time on separate halves of an array, neither touching the other half',
      },
      {
        id: 'readers',
        text: 'Several tasks reading the same value that nothing writes to',
      },
      {
        id: 'guarded',
        text: 'Two tasks incrementing the same counter, each taking the same lock first',
      },
    ],
    correctOptionIds: ['unguarded-write'],
  },
  {
    id: 'pc-concurrency-design',
    type: 'project.submission',
    lessonId: `${TRACK_ID}-concurrency-sharing-vs-passing`,
    prompt:
      'Design a counter that several tasks increment safely, once by guarding shared state and once by not sharing it at all. Write both as prose or pseudocode, not as code in any particular language, and say which you would reach for first and why.',
    artifactTypes: ['note'],
  },
];

export const programmingConceptsTrack: ProgramTrack = {
  id: TRACK_ID,
  displayName: 'Programming Concepts',
  // Programming, alongside the four language courses rather than apart from
  // them. This is the spine they hang from, not a different subject.
  subjectIds: ['programming'],
  // No language and no variant axis on purpose: the whole point is that these
  // ideas are not any one language's, and there is nothing for the runner to
  // compile an answer against.
  contentCollection: 'programming-concepts',
  focuses: [
    {
      id: 'programming-concepts-focus',
      displayName: 'Language-Agnostic Foundations',
      subjectIds: ['programming'],
    },
  ],
  offerings: [
    {
      id: OFFERING_ID,
      type: 'course',
      displayName: 'Programming Concepts',
      description:
        'The ideas underneath the languages: state, types, memory, failure and concurrency, drawn from all four courses and belonging to none of them.',
      audience:
        'Developers who know one language well and are about to be handed a second: a new team, a service in a different stack, a codebase nobody else wants. You can already write working code; what you cannot yet do is recognise a problem you have solved before when it appears in unfamiliar syntax.',
      outcome:
        'Read an unfamiliar language as variations on ideas you already know rather than as a fresh alphabet: predict whether an assignment copies or aliases, recognise a race without running anything, and say why a language made the trade it made.',
      subjectId: 'programming',
      // 200, not 100. It assumes you have finished one language course.
      level: 200,
      credits: 4,
      outcomeTags: ['foundations', 'language-agnostic', 'concepts'],
      status: 'published',
      modules: modules.map((module) => ({
        id: `${TRACK_ID}-${module.id}`,
        title: module.title,
        lessons: module.lessons.map(([slug, title], index) => ({
          id: `${TRACK_ID}-${module.id}-${slug}`,
          slug,
          title,
          content: [
            {
              format: 'file-variant' as const,
              sourcePath: `src/content/modules/${module.id}/${String(
                index + 1
              ).padStart(2, '0')}-${slug}.md`,
            },
          ],
        })),
      })),
      activities,
    },
  ],
  requirements: {
    id: `${TRACK_ID}-requirements`,
    operator: 'AND',
    children: [{ kind: 'offering', offeringId: OFFERING_ID }],
  },
};
