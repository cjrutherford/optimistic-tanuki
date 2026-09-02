export const ProjectCommands = {
  CREATE: 'project.create',
  UPDATE: 'project.update',
  DELETE: 'project.delete',
  FIND_ONE: 'project.findOne',
  REMOVE: 'project.remove',
  FIND_ALL: 'project.findAll',
  CREATE_AI_CHANGE: 'project.createAiChange',
  FIND_AI_CHANGES: 'project.findAiChanges',
  REVIEW_AI_CHANGE: 'project.reviewAiChange',
};

/**
 * Inviting somebody to work on a project.
 *
 * Separate from ProjectCommands because an invitation is its own thing with
 * its own life, and folding it in would have every project route carrying a
 * verb that only makes sense to an owner.
 */
export const ProjectInviteCommands = {
  CREATE: 'projectInvite.create',
  /** Everything outstanding on a project. Owner only: it lists addresses. */
  FIND_FOR_PROJECT: 'projectInvite.findForProject',
  /** Withdrawn by the owner, whether or not it has been answered. */
  REVOKE: 'projectInvite.revoke',
  /** Everything waiting on the caller's own address. */
  FIND_FOR_ME: 'projectInvite.findForMe',
  /** One invitation, found by the token a link carries. */
  FIND_BY_TOKEN: 'projectInvite.findByToken',
  /** The invitee's answer. Accepting is what grants access. */
  RESPOND: 'projectInvite.respond',
};

export const ProjectJournalCommands = {
  CREATE: 'projectJournal.create',
  UPDATE: 'projectJournal.update',
  DELETE: 'projectJournal.delete',
  FIND_ONE: 'projectJournal.findOne',
  REMOVE: 'projectJournal.remove',
  FIND_ALL: 'projectJournal.findAll',
};

export const RiskCommands = {
  CREATE: 'risk.create',
  UPDATE: 'risk.update',
  DELETE: 'risk.delete',
  FIND_ONE: 'risk.findOne',
  REMOVE: 'risk.remove',
  FIND_ALL: 'risk.findAll',
};

export const TaskCommands = {
  CREATE: 'task.create',
  UPDATE: 'task.update',
  DELETE: 'task.delete',
  FIND_ONE: 'task.findOne',
  REMOVE: 'task.remove',
  FIND_ALL: 'task.findAll',
};

export const ChangeCommands = {
  CREATE: 'change.create',
  UPDATE: 'change.update',
  DELETE: 'change.delete',
  FIND_ONE: 'change.findOne',
  REMOVE: 'change.remove',
  FIND_ALL: 'change.findAll',
};

export const TaskTimeEntryCommands = {
  CREATE: 'taskTimeEntry.create',
  UPDATE: 'taskTimeEntry.update',
  DELETE: 'taskTimeEntry.delete',
  FIND_ONE: 'taskTimeEntry.findOne',
  REMOVE: 'taskTimeEntry.remove',
  FIND_ALL: 'taskTimeEntry.findAll',
  STOP: 'taskTimeEntry.stop',
};

export const TaskTagCommands = {
  CREATE: 'taskTag.create',
  UPDATE: 'taskTag.update',
  DELETE: 'taskTag.delete',
  FIND_ONE: 'taskTag.findOne',
  REMOVE: 'taskTag.remove',
  FIND_ALL: 'taskTag.findAll',
};

export const TaskNoteCommands = {
  CREATE: 'taskNote.create',
  UPDATE: 'taskNote.update',
  DELETE: 'taskNote.delete',
  FIND_ONE: 'taskNote.findOne',
  REMOVE: 'taskNote.remove',
  FIND_ALL: 'taskNote.findAll',
};

export const AnalyticsCommands = {
  GET_TASK_ANALYTICS: 'analytics.getTaskAnalytics',
  GET_PROJECT_ANALYTICS: 'analytics.getProjectAnalytics',
  GET_TAG_ANALYTICS: 'analytics.getTagAnalytics',
};
