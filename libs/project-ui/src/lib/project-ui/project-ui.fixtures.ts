import type {
  Change,
  Project,
  Risk,
  Task,
  TaskNote,
  TaskTag,
  TaskTimeEntry,
} from '@optimistic-tanuki/ui-models';
import type { AssistantTurn } from './ai-assistant/assistant-conversation';
import type { AiChange } from './ai-change-review/ai-change-review.component';
import type { ProjectMessage } from './project-conversation/project-conversation.component';
import type { ProjectInvite } from './project-invites/invite-list.component';
import type { ProjectPerson } from './project-members/project-members.component';
import type { ProjectNarrative } from './project-summary/project-summary.component';

/** Sample project data for Storybook stories. */
const day = (d: number, h = 15) => new Date(Date.UTC(2026, 8, d, h));

export const sampleTags: TaskTag[] = [
  {
    id: 'tag-design',
    name: 'Design',
    color: '#8b5cf6',
    createdBy: 'profile-ari',
    createdAt: day(1),
  },
  {
    id: 'tag-backend',
    name: 'Backend',
    color: '#0ea5e9',
    createdBy: 'profile-ari',
    createdAt: day(1),
  },
  {
    id: 'tag-launch',
    name: 'Launch',
    color: '#f59e0b',
    createdBy: 'profile-mika',
    createdAt: day(2),
  },
];

const task = (
  id: string,
  title: string,
  status: Task['status'],
  priority: Task['priority'],
  due: number
): Task => ({
  id,
  projectId: 'project-launch',
  title,
  description: `${title}, with enough detail to start without a meeting.`,
  status,
  priority,
  assignee: 'profile-ari',
  dueDate: day(due),
  createdBy: 'profile-mika',
  createdAt: day(1),
  tags: [sampleTags[0]],
});

export const sampleTasks: Task[] = [
  task('task-copy', 'Write landing page copy', 'IN_PROGRESS', 'HIGH', 16),
  task('task-api', 'Wire the booking API', 'TODO', 'MEDIUM_HIGH', 18),
  task('task-review', 'Accessibility review', 'TODO', 'MEDIUM', 20),
  task('task-domain', 'Point the domain at the new host', 'DONE', 'LOW', 12),
  task(
    'task-analytics',
    'Add privacy-friendly analytics',
    'IN_PROGRESS',
    'MEDIUM_LOW',
    22
  ),
];

export const sampleRisks: Risk[] = [
  {
    id: 'risk-vendor',
    projectId: 'project-launch',
    description: 'Payment provider approval may take longer than a week.',
    impact: 'HIGH',
    likelihood: 'POSSIBLE',
    status: 'OPEN',
    createdBy: 'profile-mika',
    createdAt: day(3),
  },
  {
    id: 'risk-copy',
    projectId: 'project-launch',
    description: 'Copy sign-off depends on one reviewer.',
    impact: 'MEDIUM',
    likelihood: 'LIKELY',
    status: 'IN_PROGRESS',
    createdBy: 'profile-ari',
    createdAt: day(4),
  },
];

export const sampleChanges: Change[] = [
  {
    id: 'change-scope',
    projectId: 'project-launch',
    changeType: 'ADDITION',
    changeStatus: 'PENDING_APPROVAL',
    changeDescription: 'Add a gift-card page to launch scope.',
    changeDate: day(5),
    requestor: 'profile-mika',
    resolution: 'PENDING',
  },
  {
    id: 'change-date',
    projectId: 'project-launch',
    changeType: 'MODIFICATION',
    changeStatus: 'COMPLETE',
    changeDescription: 'Move launch from the 20th to the 24th.',
    changeDate: day(6),
    requestor: 'profile-ari',
    resolution: 'APPROVED',
  },
];

export const sampleProject: Project = {
  id: 'project-launch',
  owner: 'profile-mika',
  members: ['profile-mika', 'profile-ari'],
  name: 'Site relaunch',
  description: 'Replace the old brochure site with bookings and a shop.',
  startDate: day(1),
  endDate: day(24),
  status: 'Active',
  createdBy: 'profile-mika',
  createdAt: day(1),
  tasks: sampleTasks,
  risks: sampleRisks,
  changes: sampleChanges,
  journalEntries: [],
};

export const sampleTimeEntries: TaskTimeEntry[] = [
  {
    id: 'time-1',
    taskId: 'task-copy',
    startTime: day(14, 9),
    endTime: day(14, 11),
    elapsedSeconds: 7200,
    createdBy: 'profile-ari',
    createdAt: day(14, 9),
  },
  {
    id: 'time-2',
    taskId: 'task-analytics',
    startTime: day(14, 13),
    elapsedSeconds: 1500,
    createdBy: 'profile-ari',
    createdAt: day(14, 13),
  },
];

export const sampleNotes: TaskNote[] = [
  {
    id: 'note-1',
    taskId: 'task-copy',
    profileId: 'profile-ari',
    content: 'Hero line agreed; still need the pricing section.',
    createdAt: day(13),
  },
  {
    id: 'note-2',
    taskId: 'task-api',
    profileId: 'profile-mika',
    content: 'Use the sandbox keys until approval lands.',
    createdAt: day(13),
  },
];

export const samplePeople: ProjectPerson[] = [
  { profileId: 'profile-mika', name: 'Mika Vale', isOwner: true },
  { profileId: 'profile-ari', name: 'Ari Stone', isOwner: false },
  { profileId: 'profile-sam', name: 'Sam Reyes', isOwner: false },
];

export const sampleMessages: ProjectMessage[] = [
  {
    id: 'msg-1',
    senderId: 'profile-mika',
    content: 'Payment provider asked for our refund policy.',
    createdAt: '2026-09-14T09:05:00Z',
  },
  {
    id: 'msg-2',
    senderId: 'profile-ari',
    content: 'I will draft it this afternoon.',
    createdAt: '2026-09-14T09:12:00Z',
  },
];

export const sampleInvites: ProjectInvite[] = [
  {
    id: 'invite-1',
    email: 'sam@example.com',
    status: 'PENDING',
    createdAt: '2026-09-12T10:00:00Z',
  },
  {
    id: 'invite-2',
    email: 'jo@example.com',
    status: 'ACCEPTED',
    createdAt: '2026-09-10T10:00:00Z',
    respondedAt: '2026-09-11T08:00:00Z',
  },
];

export const sampleAssistantTurns: AssistantTurn[] = [
  { role: 'person', text: 'What is blocking launch?' },
  {
    role: 'assistant',
    text: 'Two things: the booking API is not started, and payment approval is an open high-impact risk.',
    used: [{ tool: 'list_tasks', result: '5 tasks' }],
  },
];

export const sampleAiChanges: AiChange[] = [
  {
    id: 'ai-1',
    operation: 'create_task',
    payload: { title: 'Draft refund policy' },
    reason: 'The payment provider asked for it.',
    status: 'PENDING',
    proposedBy: 'assistant',
    createdAt: '2026-09-14T09:20:00Z',
  },
  {
    id: 'ai-2',
    operation: 'update_risk',
    payload: { id: 'risk-vendor', status: 'IN_PROGRESS' },
    reason: 'Application submitted.',
    status: 'APPROVED',
    reviewedBy: 'profile-mika',
    applied: true,
    createdAt: '2026-09-13T16:00:00Z',
  },
];

export const sampleNarrative: ProjectNarrative = {
  summary: {
    headline: 'On track for the 24th if the booking API starts this week.',
    concerns: [
      {
        about: 'Booking API',
        why: 'Not started and due in four days.',
        evidenceId: 'task-api',
      },
      {
        about: 'Payment approval',
        why: "High impact and outside the team's control.",
        evidenceId: 'risk-vendor',
      },
    ],
  },
  model: 'claude-sonnet-5',
  discarded: 0,
};
