import { Activity, ProgramTrack } from './learning-domain';

/**
 * Tech Literacy: the first course here that is not about programming.
 *
 * It exists for two reasons. The first is that the audience is real and badly
 * served: people whose jobs now assume fluency with technology nobody ever
 * taught them. The second is that a platform claiming to teach any subject,
 * whose entire catalog is four programming languages, is making a claim a
 * visitor can disprove at a glance.
 *
 * So this course is also the honest test of that claim. It has no code in it,
 * uses none of the code runner, and is built entirely from the activity types
 * an author gets: multiple choice, written answers marked against a rubric,
 * and things you hand in. If it reads well and marks well, the platform is
 * what the landing page says it is.
 */
const modules = [
  {
    id: 'connected',
    title: 'How Your Screen Talks to the World',
    lessons: [
      ['request-and-response', 'What Happens When You Press Enter'],
      ['what-a-server-is', 'What a Server Actually Is'],
      ['apps-sites-accounts', 'Apps, Sites and Accounts'],
      ['when-things-go-down', 'When Things Go Down'],
    ],
  },
  {
    id: 'locks-and-keys',
    title: 'Locks and Keys',
    lessons: [
      ['what-a-password-protects', 'What a Password Actually Protects'],
      ['password-managers', 'Password Managers'],
      ['two-factor', 'Two-Factor Authentication'],
      ['what-hacked-means', 'What "I Got Hacked" Usually Means'],
    ],
  },
  {
    id: 'your-data',
    title: 'Where Your Data Actually Goes',
    lessons: [
      ['cookies', 'Cookies, Concretely'],
      ['free-services', 'What "Free" Costs'],
      ['the-cloud', 'What the Cloud Is'],
      ['privacy-settings', 'Reading a Privacy Setting'],
    ],
  },
  {
    id: 'reading-a-scam',
    title: 'Reading a Scam',
    lessons: [
      ['urgency-and-fear', 'Urgency Is the Tell'],
      ['spoofed-senders', 'Who Actually Sent This'],
      ['beyond-email', 'Texts, Calls and Fake Login Pages'],
      ['what-to-do-next', 'What to Do, and What Not to Do'],
      ['worked-examples', 'Four Messages, Decided Out Loud'],
    ],
  },
  {
    id: 'what-ai-does',
    title: 'What AI Actually Does',
    lessons: [
      ['what-a-chatbot-is-doing', 'What a Chatbot Is Doing'],
      ['where-it-helps', 'Where It Is Genuinely Useful'],
      ['where-it-fails', 'Where It Fails Quietly'],
      ['ai-and-your-data', 'What Happens to What You Type'],
    ],
  },
  {
    id: 'habits',
    title: 'The Habits That Prevent Most Losses',
    lessons: [
      ['backups', 'Backups Without the Jargon'],
      ['updates', 'Why "Later" Is a Decision'],
      ['small-habits', 'Public Wi-Fi, Locking, and Other Small Things'],
      ['monthly-check-in', 'A Five-Minute Monthly Check'],
    ],
  },
  {
    id: 'putting-it-together',
    title: 'Putting It Together',
    lessons: [
      ['your-own-audit', 'Audit Your Own Accounts'],
      ['explain-it', 'Explain One of These to Somebody Else'],
    ],
  },
] as const;

const TRACK_ID = 'tech-literacy';
const OFFERING_ID = 'tech-literacy-100-core';

/**
 * The work, and how it is marked.
 *
 * Every one of these asks the learner to apply something to a case they have
 * not seen, because a question like "what does 2FA stand for" tests vocabulary
 * and nothing else. The written ones are graded against these rubrics by a
 * model that has to quote the learner's own words to award a point, so the
 * criteria are written as things a marker could actually find in a sentence.
 */
const activities: Activity[] = [
  {
    id: 'tl-connected-explain',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-connected-request-and-response`,
    prompt:
      'A colleague asks what actually happens between typing an address and the page appearing. Explain it to them in three or four sentences, without using the word "magic".',
    maxWords: 200,
    sampleResponse:
      'Your browser looks up which computer the address belongs to, then sends that computer a request over the internet. That computer, the server, decides what to send back and returns the page. Your browser reads what came back and draws it on screen. The whole trip usually takes a fraction of a second, and it happens again every time you click something.',
    rubric: {
      id: 'tl-connected-rubric',
      title: 'Explaining a request',
      criteria: [
        {
          id: 'order',
          description:
            'Describes the request going out before the response comes back, rather than treating the page as simply appearing.',
          maxPoints: 4,
        },
        {
          id: 'server',
          description:
            'Names the other end as a computer or server that receives the request and decides what to send.',
          maxPoints: 3,
        },
        {
          id: 'plain',
          description:
            'Explains rather than hand-waves: no unexplained jargon and no appeal to it being complicated.',
          maxPoints: 3,
        },
      ],
    },
  },
  {
    id: 'tl-locks-project',
    type: 'project.submission',
    lessonId: `${TRACK_ID}-locks-and-keys-two-factor`,
    // Deliberately no screenshot.
    //
    // This asked for one, with "any codes blacked out". A two-factor setup
    // screen routinely shows a QR code, which encodes the shared secret
    // outright, and a list of backup codes, any one of which bypasses the
    // second factor entirely. A reader of this course is by definition not
    // yet practised at spotting which parts of that screen are the dangerous
    // ones, and blacking out the six-digit code while leaving the QR visible
    // is the obvious mistake to make.
    //
    // It also contradicted the course. The lesson on what you hand to a
    // service argues against putting sensitive things into a box because
    // somebody asked. Asking for exactly that, as coursework, teaches the
    // habit the module is trying to break. Writing what happened proves the
    // same thing and risks nothing.
    prompt:
      'Set up a password manager, and turn on two-factor authentication for one account that matters to you. Then write a short note: which account you chose and why that one, which second factor you used and why, and what the service told you to do if you lose access to it. Do not send a screenshot, and do not include any codes, backup codes, or recovery phrases. Describing it is the point; the codes are yours and nobody marking this needs them.',
    artifactTypes: ['note'],
  },
  {
    id: 'tl-data-quiz',
    type: 'quiz.mcq',
    lessonId: `${TRACK_ID}-your-data-free-services`,
    prompt:
      'A free photo-editing app asks for access to your contacts so it can "help you find friends". What is the most likely reason it wants them?',
    options: [
      {
        id: 'sell',
        text: 'Your contact list is worth money, and sharing it is how the app is paid for',
      },
      {
        id: 'friends',
        text: 'It genuinely cannot show you friends without it',
      },
      { id: 'security', text: 'It needs them to keep your account secure' },
      {
        id: 'required',
        text: 'App stores require it before an app can publish',
      },
    ],
    correctOptionIds: ['sell'],
  },
  {
    id: 'tl-scam-read',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-reading-a-scam-worked-examples`,
    prompt:
      'Look again at the four messages in this lesson. Pick the one you are most confident is a scam, say which it is, and name the specific things that gave it away. "It felt off" is not an answer; say what you would point at.',
    maxWords: 250,
    sampleResponse:
      "The delivery notice. The sender address is a lookalike domain rather than the courier's real one, it opens with a generic greeting even though a real courier would have my name from the order, and it wants a small payment to release a parcel I am not expecting. Any one of those might be sloppiness; together they are the shape of a scam. The link text and where it actually points do not match either.",
    rubric: {
      id: 'tl-scam-rubric',
      title: 'Reading a scam',
      criteria: [
        {
          id: 'names-signal',
          description:
            'Names at least one concrete, checkable signal such as the sender domain, a mismatched link, an unexpected payment request, or a generic greeting.',
          maxPoints: 5,
        },
        {
          id: 'second-signal',
          description:
            'Names a second independent signal, rather than restating the first in different words.',
          maxPoints: 3,
        },
        {
          id: 'reasoning',
          description:
            'Explains why the signal matters, rather than only listing it.',
          maxPoints: 2,
        },
      ],
    },
  },
  {
    id: 'tl-ai-calibrate',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-what-ai-does-where-it-fails`,
    prompt:
      'Ask a chatbot a factual question you can check independently. Say what you asked, whether it was right, and how you would have known if you had no way to check.',
    maxWords: 250,
    sampleResponse:
      'I asked for the opening date of a local library and it gave a confident, specific year that turned out to be wrong by a decade. Nothing in the answer signalled uncertainty: it read exactly like the answers that were right. That is the point. If I had not been able to check, I would have had no way to tell, which is why I would not use it for anything where being wrong matters and I cannot verify it.',
    rubric: {
      id: 'tl-ai-rubric',
      title: 'Calibrating trust',
      criteria: [
        {
          id: 'specific',
          description:
            'Names an actual question they asked and what the answer was, rather than describing chatbots in general.',
          maxPoints: 4,
        },
        {
          id: 'confidence',
          description:
            'Observes that a wrong answer is delivered as confidently as a right one, so tone carries no information about accuracy.',
          maxPoints: 4,
        },
        {
          id: 'rule',
          description:
            'Draws a usable rule for when they would and would not rely on it.',
          maxPoints: 2,
        },
      ],
    },
  },
  {
    id: 'tl-habits-project',
    type: 'project.submission',
    lessonId: `${TRACK_ID}-habits-monthly-check-in`,
    // A settings screen is a fair thing to show, unlike a two-factor setup
    // screen, but it still carries a device name and often an account email,
    // so the prompt says what to leave out rather than assuming it is obvious.
    prompt:
      'Turn on automatic updates for one device, and write down your backup plan for it: what is backed up, where it goes, and how you would get it back. Hand in both. If you show the settings screen, crop or cover your account email and anything else identifying: the marker only needs to see that updates are on.',
    artifactTypes: ['screenshot', 'note'],
  },
  {
    id: 'tl-teach-it',
    type: 'writing.response',
    lessonId: `${TRACK_ID}-putting-it-together-explain-it`,
    prompt:
      'Pick one thing from this course and explain it to somebody who has never heard of it. Write what you would actually say to them, not a definition.',
    maxWords: 300,
    sampleResponse:
      'Two-factor authentication means that knowing your password is not enough to get into your account. After the password, the account asks for a second thing: usually a code from an app on your phone. The reason it helps is that passwords leak. Companies get breached and lists of passwords end up for sale, and if somebody buys yours they can walk straight in. With the second step they cannot, because they would also need your phone. It takes about two minutes to turn on and it is the single most useful thing you can do for an account you care about.',
    rubric: {
      id: 'tl-teach-rubric',
      title: 'Teaching it back',
      criteria: [
        {
          id: 'correct',
          description:
            'The explanation is accurate. Nothing in it would have to be unlearned later.',
          maxPoints: 4,
        },
        {
          id: 'audience',
          description:
            'Written for somebody who does not already know: no unexplained jargon, and no assumed background.',
          maxPoints: 3,
        },
        {
          id: 'why',
          description:
            'Says why it matters or what it prevents, not only what it is.',
          maxPoints: 3,
        },
      ],
    },
  },
];

export const techLiteracyTrack: ProgramTrack = {
  id: TRACK_ID,
  displayName: 'Tech Literacy',
  // Not "programming". This is the whole point of the course existing.
  subjectIds: ['digital-literacy'],
  // No supportedLanguageIds and no variantAxis: there is no code in this
  // course, so there is no language for the runner to key on and nothing for
  // the lessons to vary along.
  contentCollection: 'tech-literacy',
  focuses: [
    {
      id: 'tech-literacy-focus',
      displayName: 'Everyday Technology',
      subjectIds: ['digital-literacy'],
    },
  ],
  offerings: [
    {
      id: OFFERING_ID,
      type: 'course',
      displayName: 'Tech Literacy',
      description:
        'The technology your job now assumes you understand, explained without condescension and without code.',
      audience:
        'Anyone whose work has quietly come to depend on technology nobody ever taught them: the person approving software they do not understand, fielding questions about a system they were handed, or tired of asking a younger colleague to do it for them.',
      outcome:
        'Tell a scam from a real message and say what gave it away, set up a password manager and two-factor authentication, explain what happens to your data in terms a colleague would follow, and judge when a chatbot can be trusted and when it cannot.',
      subjectId: 'digital-literacy',
      level: 100,
      credits: 3,
      outcomeTags: ['digital-literacy', 'security', 'foundations'],
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
  // Finishing the track means finishing its one course, which is the same
  // shape the ported tracks use.
  requirements: {
    id: `${TRACK_ID}-requirements`,
    operator: 'AND',
    children: [{ kind: 'offering', offeringId: OFFERING_ID }],
  },
};
