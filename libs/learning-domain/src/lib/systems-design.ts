import { Activity, ProgramTrack } from './learning-domain';

/**
 * Systems Design: the gap between writing code and building something that
 * stays up.
 *
 * Every other course here teaches you to make something work. This one is
 * about what happens next: the second writer, the slow dependency, the schema
 * that has to change while people are using it, the route that quietly hands
 * out more than it meant to.
 *
 * Its examples come from this workspace, which is an advantage most courses of
 * this kind do not have. Design courses usually argue from a hypothetical
 * e-commerce site nobody has ever run. Every incident cited here happened in
 * the platform serving the lesson, and the fix is readable in the repository
 * at the path the lesson names.
 *
 * Language-agnostic and code-free in the same way Tech Literacy is: the work
 * is argued rather than compiled, which is also what makes it the hardest test
 * of the rubric-marking path.
 */
const TRACK_ID = 'systems-design';
const OFFERING_ID = 'systems-design-300-core';

const modules = [
  {
    id: 'boundaries',
    title: 'Boundaries',
    lessons: [
      ['what-a-boundary-buys', 'What a Boundary Buys You'],
      ['what-a-boundary-costs', 'And What It Charges'],
      ['where-to-cut', 'Cutting Along the Grain'],
      ['the-edge-is-the-contract', 'The Edge Is the Contract'],
      ['degrading-not-failing', 'Missing a Part Without Losing the Page'],
    ],
  },
  {
    id: 'state',
    title: 'State and Ownership',
    lessons: [
      ['who-owns-this-row', 'Who Owns This Row'],
      ['two-writers', 'When Two Writers Arrive at Once'],
      ['read-modify-write', 'The Read, the Change, and the Gap Between'],
      ['let-the-database-decide', 'Letting the Database Settle It'],
      ['the-index-is-the-rule', 'The Constraint Is the Rule, Not the Comment'],
    ],
  },
  {
    id: 'failure',
    title: 'Failure',
    lessons: [
      ['everything-is-a-timeout', 'Every Call Is a Timeout Waiting to Happen'],
      ['a-timeout-is-not-an-answer', 'A Timeout Tells You Nothing'],
      ['retries-make-it-worse', 'When Retrying Makes It Worse'],
      ['idempotency', 'Doing It Twice on Purpose'],
      ['budgets-not-guesses', 'A Timeout Is a Budget, Not a Guess'],
    ],
  },
  {
    id: 'authorization',
    title: 'Authorization as Design',
    lessons: [
      ['not-a-middleware', 'Authorization Is Not a Middleware'],
      ['who-is-asking', 'The Answer Depends on Who Is Asking'],
      ['never-trust-the-client', 'Marks the Client Cannot Write'],
      ['absence-is-disclosure', 'What Silence Gives Away'],
      ['project-at-the-edge', 'Project at the Edge, Not in the Middle'],
    ],
  },
  {
    id: 'change',
    title: 'Changing a Running System',
    lessons: [
      ['the-schema-is-deployed-too', 'The Schema Ships Too'],
      ['generated-not-handwritten', 'Why Nobody Should Write a Migration'],
      ['drift', 'How a Schema and Its Code Come Apart'],
      ['expand-and-contract', 'Changing a Column Without Stopping'],
      ['adding-must-not-remove', 'Adding a Thing That Removes a Thing'],
    ],
  },
  {
    id: 'knowing',
    title: 'Knowing It Works',
    lessons: [
      ['green-is-not-working', 'A Green Suite Is Not a Working System'],
      ['test-the-seam', 'Test Doubles Drift From What They Double'],
      ['run-the-real-thing', 'Run the Real Thing'],
      ['make-it-fail-first', 'A Test You Have Not Seen Fail'],
      ['limits-you-can-state', 'Saying What You Did Not Check'],
    ],
  },
] as const;

const activities: Activity[] = [
  {
    id: 'sd-boundaries-cost',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-boundaries-what-a-boundary-costs`,
    prompt:
      'A team proposes splitting one service into three because the codebase has grown large. Argue either for or against, in terms of what the split buys and what it charges. Name at least two costs that appear only after the split is live.',
    maxWords: 300,
    rubric: {
      id: 'sd-boundaries-rubric',
      title: 'A split as a trade',
      criteria: [
        {
          id: 'trade',
          description:
            'Treats the split as a trade rather than an improvement, and ties the recommendation to what it costs rather than to codebase size.',
          maxPoints: 4,
        },
        {
          id: 'costs',
          description:
            'Names at least two concrete costs that appear only once the split is live: a call that could not fail now can, one transaction becomes two with no rollback across them, a change needs coordinated deploys, debugging crosses a process boundary.',
          maxPoints: 4,
        },
        {
          id: 'reason',
          description:
            'Gives a reason to split that is actually implied by the evidence, such as independent deployment or a different failure or scaling profile.',
          maxPoints: 2,
        },
      ],
    },
    sampleResponse:
      'Codebase size is the wrong reason on its own, because a large codebase can be split into modules without being split into processes. The split buys independent deployment and a hard enforcement of the boundary: once the call is over a network, nobody can reach past the interface. It charges for that twice. First, a call that used to be a function call can now be slow, fail, or return after the caller gave up, so every call site needs an answer for that case where before it needed none. Second, a change that spans the boundary now needs two deploys in an order, and for a window the two sides are running different versions of the contract. There is a third cost that only shows up later: one database transaction becomes two, and there is no rollback across them, so any operation touching both sides has to be made safe to retry instead. I would split only if the teams need to deploy independently, or one side has a genuinely different scaling or failure profile. Neither is implied by the code being large.',
  },
  {
    id: 'sd-state-lost-update',
    type: 'quiz.mcq',
    lessonId: `${TRACK_ID}-state-read-modify-write`,
    prompt:
      'Two requests for the same learner finish an exercise at the same moment. Each reads the progress row, adds its exercise id to the list, and writes the row back. One of the two updates is missing afterwards. What actually went wrong?',
    options: [
      {
        id: 'gap',
        text: 'Both read the same row before either wrote, so the second write was computed from a value that was already stale',
      },
      {
        id: 'slow-db',
        text: 'The database was too slow to keep up with two writes arriving together',
      },
      {
        id: 'no-index',
        text: 'The table was missing an index, so the second write could not find the row',
      },
      {
        id: 'ordering',
        text: 'The two requests arrived out of order, so the older one was applied last',
      },
    ],
    correctOptionIds: ['gap'],
  },
  {
    id: 'sd-state-atomic',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-state-let-the-database-decide`,
    prompt:
      'Explain how moving the merge into a single statement fixes a lost update, and say what that fix depends on to work. Be specific about the thing that would silently stop protecting you if it went missing.',
    maxWords: 250,
    rubric: {
      id: 'sd-state-atomic-rubric',
      title: 'The merge and what it rests on',
      criteria: [
        {
          id: 'gap',
          description:
            'Explains that a single merging statement closes the read-then-write gap, because nothing is computed from a value that has gone stale.',
          maxPoints: 4,
        },
        {
          id: 'constraint',
          description:
            'Identifies that the merge depends on a unique constraint on the conflicted columns to have a conflict to detect at all.',
          maxPoints: 4,
        },
        {
          id: 'silent',
          description:
            'Notes that without the constraint the statement inserts a second row instead of merging, so the protection disappears with no error.',
          maxPoints: 2,
        },
      ],
    },
    sampleResponse:
      'The bug is the gap between reading the row and writing it back. Two requests both read the same value, each computes a new one from it, and whichever writes second overwrites the first, because it built its answer from a value that stopped being true while it held it. Doing the merge in one statement removes the gap: instead of sending the final value, you send the change and let the database combine it with whatever is actually there when it runs. Nothing is computed from a stale read because nothing is read separately. What that depends on is a unique constraint on the columns being conflicted against. The statement only merges when the database detects a conflict, and it only detects one because a constraint says those columns cannot repeat. Take the constraint away and there is no conflict to find, so the statement cheerfully inserts a second row and both writes appear to succeed. Nothing errors. You get duplicate rows and the lost update comes back, just with an extra symptom. That makes the constraint part of the correctness of the code, not a tuning decision, and it is why it belongs on the entity next to the code that relies on it.',
  },
  {
    id: 'sd-failure-idempotency',
    type: 'quiz.mcq',
    lessonId: `${TRACK_ID}-failure-idempotency`,
    prompt:
      'A request times out. The caller does not know whether the work happened. Which property makes retrying safe?',
    options: [
      {
        id: 'same-effect',
        text: 'Applying the request twice leaves the system in the same state as applying it once',
      },
      {
        id: 'fast',
        text: 'The operation is fast enough that a second attempt finishes before anything else observes it',
      },
      {
        id: 'read-only',
        text: 'The operation only reads data and never writes any',
      },
      {
        id: 'logged',
        text: 'The operation writes to a log, so a duplicate can be found and reversed afterwards',
      },
    ],
    correctOptionIds: ['same-effect'],
  },
  {
    id: 'sd-failure-timeout',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-failure-budgets-not-guesses`,
    prompt:
      'A route that asks a language model to mark written work sits behind a gateway with a thirty second default timeout. Learners report that marking is broken. The marking itself completes fine moments later. Explain what the learner experiences, why this is worse than an outright failure, and what you would change.',
    maxWords: 300,
    rubric: {
      id: 'sd-failure-timeout-rubric',
      title: 'Giving up against failing',
      criteria: [
        {
          id: 'distinction',
          description:
            'Separates the caller giving up from the work failing, and says the marking actually succeeded after the gateway stopped waiting.',
          maxPoints: 4,
        },
        {
          id: 'worse',
          description:
            'Explains why this is worse than a clean failure: it is indistinguishable from a broken feature, and it leaves real state behind that the learner was told did not happen.',
          maxPoints: 3,
        },
        {
          id: 'budget',
          description:
            'Proposes a timeout sized to the operation from measurement rather than a single global default, and does not simply raise the default for everything.',
          maxPoints: 3,
        },
      ],
    },
    sampleResponse:
      'The learner submits an answer, waits, and is told the request failed. The marking was not failing. The gateway had its own thirty second limit, and model work takes longer than that, so the gateway stopped waiting and answered with an error while the work carried on downstream and finished successfully. The learner sees a broken feature. If they resubmit, the work is done twice. If they check later, they may find a mark for something they were told had failed, which is more confusing than a clean error. This is worse than an outright failure because nothing failed: there is no error downstream to find, the logs on the marking side look healthy, and the only sign of a problem is a complaint. A timeout that fires while the work succeeds leaves the caller and the system disagreeing about what happened. The fix is to size the timeout to the operation instead of applying one number to everything. A model-bound route needs a limit derived from how long that model actually takes on the slow path, measured rather than guessed. Raising the global default to match would be wrong, because it would also give every fast route permission to hang for ten minutes, and the whole value of a short default is catching the routes that should never be slow.',
  },
  {
    id: 'sd-authz-owner',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-authorization-who-is-asking`,
    prompt:
      'One route serves both a public course page and the editor its author uses. The page must not show the answer key; the editor must. Describe how you would resolve this, and describe a wrong fix that looks correct until you consider the editor.',
    maxWords: 300,
    rubric: {
      id: 'sd-authz-owner-rubric',
      title: 'The fix that looks right',
      criteria: [
        {
          id: 'depends',
          description:
            'Describes returning the record whole to the owner and projected to everyone else, with the projection applied where it leaves the server.',
          maxPoints: 4,
        },
        {
          id: 'wrong-fix',
          description:
            'Identifies stripping it unconditionally as the tempting wrong fix, and explains that the editor loads from this route and saves back a full replacement.',
          maxPoints: 4,
        },
        {
          id: 'silent',
          description:
            'Notes the wrong fix fails silently and destroys data rather than erroring, which is worse than the leak it was meant to close.',
          maxPoints: 2,
        },
      ],
    },
    sampleResponse:
      'The answer has to depend on who is asking. Resolve the caller, decide whether they own the record, and return it whole to the owner and projected to everyone else, with the projection applied at the point it leaves the service rather than trusted to the client. The wrong fix is to strip the answer key unconditionally, which is exactly what you would reach for if you only looked at the public page. It works there. It fails in the editor, and it fails quietly. The editor loads from this same route and saves activities back as a full replacement, so an author who opens their own course receives a copy with the answers missing, changes a title, saves, and writes the stripped version over their own mark scheme. Nothing errors. The save succeeds. The answers are simply gone, and nobody finds out until a learner is marked against nothing. That failure is worse than the leak it was meant to fix, because a leak can be closed afterwards and deleted data cannot be recovered. The deeper problem is one route serving two audiences with opposite requirements. Making the response depend on the caller is a fair resolution, but only if you check every consumer of that route, especially the ones that write back what they read.',
  },
  {
    id: 'sd-authz-trust',
    type: 'quiz.mcq',
    lessonId: `${TRACK_ID}-authorization-never-trust-the-client`,
    prompt:
      'Which of these endpoints is unsafe by design, regardless of how carefully it is implemented?',
    options: [
      {
        id: 'client-score',
        text: 'One that accepts a score in the request body and stores it against the learner',
      },
      {
        id: 'server-score',
        text: 'One that accepts an answer, marks it on the server, and stores the result',
      },
      {
        id: 'read-progress',
        text: 'One that returns the signed-in learner their own recorded progress',
      },
      {
        id: 'enrol',
        text: 'One that enrols the signed-in learner in a published course',
      },
    ],
    correctOptionIds: ['client-score'],
  },
  {
    id: 'sd-change-drift',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-change-drift`,
    prompt:
      'Describe how a database schema and the code that depends on it can come apart even though every migration ran successfully and every test passed. Give a concrete mechanism, not just "someone forgot".',
    maxWords: 300,
    rubric: {
      id: 'sd-change-drift-rubric',
      title: 'A mechanism, not a warning',
      criteria: [
        {
          id: 'mechanism',
          description:
            'Names a specific mechanism rather than a general caution: a migration that does not match the entity, a constraint the code silently depends on being absent, bookkeeping keyed on class name, or a test database built from entities rather than from the migrations.',
          maxPoints: 5,
        },
        {
          id: 'silent',
          description:
            'Explains why the failure is silent: migrations run, tests pass, and the damage shows up as behaviour rather than as an error.',
          maxPoints: 3,
        },
        {
          id: 'remedy',
          description:
            'Draws a conclusion that follows, such as generating migrations from the entities or testing against the schema the migrations actually produce.',
          maxPoints: 2,
        },
      ],
    },
    sampleResponse:
      'The clearest mechanism is a hand-written migration that drifts from what the entity declares. The entity says a pair of columns is unique. The migration that actually builds the table was written by a person who added the columns and not the constraint. Every migration runs successfully, because nothing about it is invalid. Tests pass, because the test database is often built from the entity definitions rather than by running the migrations, so the constraint is present in tests and absent in production. Nothing errors anywhere. The damage shows up in behaviour rather than in an exception: code that relies on a conflict being detected finds no conflict, so an operation meant to merge quietly inserts instead. A second mechanism is bookkeeping. The migration table records which migrations ran, keyed on the class name. Rename a class to satisfy a lint rule and the recorded name no longer matches, so migrations that already ran look pending and the tool offers to run them again. The common thread is that none of this fails loudly. That is the argument for generating migrations from the entities rather than writing them, and for running tests against the schema the migrations actually produce.',
  },
  {
    id: 'sd-knowing-green',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-knowing-green-is-not-working`,
    prompt:
      'Give a concrete example of a change where the whole test suite passes and the system is nevertheless broken. Then say what you would do differently to catch that class of problem.',
    maxWords: 300,
    rubric: {
      id: 'sd-knowing-green-rubric',
      title: 'Green and broken',
      criteria: [
        {
          id: 'example',
          description:
            'Gives a concrete example where the suite passes and the system is broken, such as a drifted test double, a schema difference, or tests that silently stopped running.',
          maxPoints: 4,
        },
        {
          id: 'why',
          description:
            'Explains why the suite cannot see it, rather than treating it as an oversight someone should have avoided.',
          maxPoints: 3,
        },
        {
          id: 'practice',
          description:
            'Proposes something that catches this class: exercising the real thing, or making a test prove itself by confirming it fails when the fix is removed.',
          maxPoints: 3,
        },
      ],
    },
    sampleResponse:
      'A test double that has drifted from the thing it doubles. A component calls a method on a service, and the test provides a stand-in with that method on it. If the real service never had that method, or lost it in a refactor, both the component and the double are wrong in the same direction and agree with each other, so every test passes. Nothing catches it until the real object arrives at runtime, or until a build with real type checking runs. The suite is not lying: it is faithfully testing a system made of doubles that nobody ships. A second example is a suite that stops running some of its tests. If a file fails to compile after an edit, some runners report the tests that did run and count the file as absent rather than failed, so the total drops and everything is green. Nobody notices unless they compare the count to what it was. What I would do differently is exercise the real thing at least once per change: build the artifact and call the running service, not just the unit under test. And I would make each test prove itself by removing the fix and confirming that exactly the expected tests fail. A test I have never seen fail is a test I have no reason to believe in.',
  },
  {
    id: 'sd-design-review',
    type: 'project.submission',
    lessonId: `${TRACK_ID}-knowing-limits-you-can-state`,
    prompt:
      'Write a design note for a feature that records something a user earns: a mark, a badge, a completed step. Cover where the state lives and who owns it, what happens when two requests arrive at once, what the caller sees when a dependency is slow or down, who is allowed to write it and how the server knows, and how you would change its schema later without downtime. Close with a section stating plainly what you did not check and what would change your mind. That last section is marked as seriously as the rest.',
    artifactTypes: ['note'],
  },
];

export const systemsDesignTrack: ProgramTrack = {
  id: TRACK_ID,
  displayName: 'Systems Design',
  // Programming, but at the far end of it. This sits above the four language
  // courses and above Programming Concepts: it assumes you can already write
  // the code and asks what happens once other people are using it.
  subjectIds: ['programming'],
  // No language and no variant axis. Design is argued, not compiled, so there
  // is nothing here for the runner to execute.
  contentCollection: 'systems-design',
  focuses: [
    {
      id: 'systems-design-focus',
      displayName: 'Building Things That Stay Up',
      subjectIds: ['programming'],
    },
  ],
  offerings: [
    {
      id: OFFERING_ID,
      type: 'course',
      displayName: 'Systems Design',
      description:
        'The gap between writing code and building something that stays up: boundaries, ownership of state, failure, authorization, and changing a system while people are using it. Every example is drawn from the platform serving this lesson.',
      audience:
        'Developers who can build a working feature and have started being asked harder questions about it: what happens when two people do this at once, what happens when that service is down, how do we change this table without a maintenance window. You have probably already been surprised by one of those in production.',
      outcome:
        'Argue a design rather than assert one: name what a boundary costs as readily as what it buys, find the read-then-write gap in a piece of code, size a timeout from evidence, tell the difference between a leak and a silent data loss, and state plainly what you have not checked.',
      subjectId: 'programming',
      // 300. It assumes the two courses below it and some real experience.
      level: 300,
      credits: 5,
      outcomeTags: ['systems', 'design', 'architecture', 'reliability'],
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
