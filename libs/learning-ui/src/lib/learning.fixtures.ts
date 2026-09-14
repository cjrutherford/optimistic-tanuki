import type { CurriculumPreviewCourse } from './curriculum-preview.component';
import type { OfferingPrerequisite } from './offering-summary.component';
import type { SubjectNavItem } from './subject-nav.component';
import type { ValueProp } from './value-props.component';

/** Sample catalog data for Storybook stories. */
export const sampleSubjects: SubjectNavItem[] = [
  { subjectId: 'programming', displayName: 'Programming', courseCount: 12 },
  { subjectId: 'design', displayName: 'Design', courseCount: 5 },
  { subjectId: 'finance', displayName: 'Personal finance', courseCount: 3 },
];

export const sampleCourses: CurriculumPreviewCourse[] = [
  {
    offeringId: 'go-basics',
    displayName: "Let's Go: the language in a week",
    audience: 'Developers who know another language and want to ship Go.',
    lessonCount: 14,
    subjectName: 'Programming',
  },
  {
    offeringId: 'type-systems',
    displayName: 'Type systems for working programmers',
    audience: '',
    lessonCount: 9,
    subjectName: 'Programming',
  },
  {
    offeringId: 'budgeting',
    displayName: 'A budget you will actually keep',
    audience: 'Anyone who has abandoned a spreadsheet budget.',
    lessonCount: 6,
    subjectName: 'Personal finance',
  },
];

export const sampleValueProps: ValueProp[] = [
  {
    title: 'Runs your code',
    body: 'Every exercise compiles and runs in the browser, so feedback is immediate.',
  },
  {
    title: 'Written by practitioners',
    body: 'Courses come from people who do the work, and say who they are.',
  },
  {
    title: 'Yours offline',
    body: 'Install the app and keep reading without a connection.',
  },
];

export const samplePrerequisites: OfferingPrerequisite[] = [
  { offeringId: 'go-basics', displayName: "Let's Go: the language in a week" },
];
