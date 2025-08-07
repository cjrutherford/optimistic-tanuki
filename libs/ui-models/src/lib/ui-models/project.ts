// src/app/models/project.model.ts
// src/app/models/project.model.ts
/**
 * Represents a project entity.
 */
export interface Project {
  /** The unique identifier of the project. */
  id: string; // uuid
  /** The owner of the project. */
  owner: string;
  /** The members of the project. */
  members: string[];
  /** The name of the project. */
  name: string;
  /** The description of the project. */
  description: string;
  /** The start date of the project. */
  startDate: Date;
  /** The end date of the project. */
  endDate: Date;
  /** The status of the project (e.g., 'Active', 'Completed', 'On Hold'). */
  status: string; // e.g., 'Active', 'Completed', 'On Hold'
  /** The user who created the project. */
  createdBy: string;
  /** The creation timestamp of the project. */
  createdAt: Date;
  /** The user who last updated the project (optional). */
  updatedBy?: string;
  /** The last update timestamp of the project (optional). */
  updatedAt?: Date;
  /** The user who deleted the project (optional). */
  deletedBy?: string;
  /** The deletion timestamp of the project (optional). */
  deletedAt?: Date;
  /** Array of Task objects associated with the project. */
  tasks: Task[]; // Array of Task objects
  /** Array of Risk objects associated with the project. */
  risks: Risk[]; // Array of Risk objects
  /** Array of Change objects associated with the project. */
  changes: Change[]; // Array of Change objects
  /** Array of ProjectJournal objects associated with the project. */
  journalEntries: ProjectJournal[]; // Array of ProjectJournal objects
  /** Array of Timer objects associated with the project. */
  timers: Timer[]; // Array of Timer objects
}

/**
 * Data transfer object for creating a new project.
 */
export interface CreateProject {
  /** The owner of the project. */
  owner: string;
  /** The members of the project. */
  members: string[];
  /** The name of the project. */
  name: string;
  /** The description of the project. */
  description: string;
  /** The status of the project. */
  status: string;
  /** The start date of the project. */
  startDate: Date;
  /** The end date of the project (optional). */
  endDate?: Date;
  /** The user who created the project. */
  createdBy: string;
}

/**
 * Data transfer object for querying projects.
 */
export interface QueryProject {
    /** The owner of the project (optional). */
  owner?: string;
  /** The members of the project (optional). */
  members?: string[];
  /** The name of the project (optional). */
  name?: string;
  /** The description of the project (optional). */
  description?: string;
  /** The creation date range for the project (optional). */
  createdAt?: [Date, Date]; 
  /** The update date range for the project (optional). */
  updatedAt?: [Date, Date]; 
  /** The user who created the project (optional). */
  createdBy?: string;
  /** The user who last updated the project (optional). */
  updatedBy?: string;
  /** Whether the project is deleted (optional). */
  deleted?: boolean; 
}

// src/app/models/task.model.ts
/**
 * Represents a task entity.
 */
export interface Task {
  /** The unique identifier of the task. */
  id: string; // uuid
  /** Foreign key to Project. */
  projectId: string; // Foreign key to Project
  /** The title of the task. */
  title: string;
  /** The description of the task. */
  description: string;
  /** The status of the task. */
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED'; // Assuming status is a string enum
  /** The priority of the task. */
  priority: 'LOW' | 'MEDIUM_LOW' | 'MEDIUM' | 'MEDIUM_HIGH' | 'HIGH'; // Assuming priority is a string enum
  /** The assignee of the task. */
  assignee: string; // Assuming 'createdBy' in ER is 'assignee' for task context
  /** The due date of the task. */
  dueDate: Date; // Added based on wireframe display
  /** The user who created the task. */
  createdBy: string;
  /** The creation timestamp of the task. */
  createdAt: Date;
  /** The user who last updated the task (optional). */
  updatedBy?: string;
  /** The last update timestamp of the task (optional). */
  updatedAt?: Date;
  /** The user who deleted the task (optional). */
  deletedBy?: string;
  /** The deletion timestamp of the task (optional). */
  deletedAt?: Date;
}

/**
 * Data transfer object for creating a new task.
 */
export interface CreateTask {
  /** Foreign key to Project. */
  projectId: string; 
  /** The title of the task. */
  title: string;
  /** The description of the task. */
  description: string;
  /** The status of the task. */
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
  /** The priority of the task. */
  priority: 'LOW' | 'MEDIUM_LOW' | 'MEDIUM' | 'MEDIUM_HIGH' | 'HIGH'; 
  /** The user who created the task. */
  createdBy: string;
}

/**
 * Data transfer object for querying tasks.
 */
export interface QueryTask {
  /** Optional filter by project ID. */
  projectId?: string;
  /** Optional filter by title. */
  title?: string;
  /** Optional filter by description. */
  description?: string;
  /** Optional filter by status. */
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
  /** Optional filter by priority. */
  priority?: 'LOW' | 'MEDIUM_LOW' | 'MEDIUM' | 'MEDIUM_HIGH' | 'HIGH';
  /** Optional filter by assignee. */
  assignee?: string; 
  /** Optional due date range. */
  dueDate?: [Date, Date]; 
  /** Optional creation date range. */
  createdAt?: [Date, Date]; 
  /** Optional update date range. */
  updatedAt?: [Date, Date]; 
  /** Optional filter by creator. */
  createdBy?: string;
  /** Optional filter by updater. */
  updatedBy?: string;
  /** Optional filter by deletion status. */
  deleted?: boolean; 
}

// src/app/models/timer.model.ts
/**
 * Represents a timer entity.
 */
export interface Timer {
  /** The unique identifier of the timer (optional). */
  id?: string; // uuid
  /** Foreign key to Task. */
  taskId: string; 
  /** The status of the timer. */
  status: 'Running' | 'Paused' | 'Stopped';
  /** The start time of the timer. */
  startTime: Date;
  /** The end time of the timer (optional). */
  endTime?: Date;
  /** The elapsed time in seconds. */
  elapsedTime: number; // in seconds
  /** The user who last updated the timer (optional). */
  updatedBy?: string;
  /** The last update timestamp of the timer (optional). */
  updatedAt?: Date;
  /** The user who deleted the timer (optional). */
  deletedBy?: string;
  /** The deletion timestamp of the timer (optional). */
  deletedAt?: Date;
}

/**
 * Data transfer object for creating a new timer.
 */
export interface CreateTimer {
  /** Foreign key to Task. */
  taskId: string; // Foreign key to Task
  /** The status of the timer. */
  status: 'Running' | 'Paused' | 'Stopped';
  /** The start time of the timer. */
  startTime: Date;
  /** The end time of the timer (optional). */
  endTime?: Date;
  /** The elapsed time in seconds. */
  elapsedTime: number; // in seconds
}


// src/app/models/risk.model.ts
/**
 * Represents a risk entity.
 */
export interface Risk {
  /** The unique identifier of the risk. */
  id: string; // uuid
  /** Foreign key to Project. */
  projectId: string; // Foreign key to Project
  /** The description of the risk. */
  description: string;
  /** The impact level of the risk. */
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  /** The likelihood of the risk occurring. */
  likelihood: 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'IMMINENT' | 'ALMOST_CERTAIN' | 'CERTAIN' | 'NOT_APPLICABLE' | 'UNKNOWN'; 
  /** The status of the risk. */
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  /** The resolution of the risk (optional). */
  resolution?: 'PENDING' |'ACCEPTED' | 'MITIGATED' |'ESCALATED' | 'AVOIDED';
  /** The mitigation plan for the risk (optional). */
  mitigationPlan?: string;
  /** The owner of the risk (optional). */
  riskOwner?: string; 
  /** The user who created the risk. */
  createdBy: string;
  /** The creation timestamp of the risk. */
  createdAt: Date;
  /** The user who last updated the risk (optional). */
  updatedBy?: string;
  /** The last update timestamp of the risk (optional). */
  updatedAt?: Date;
  /** The user who deleted the risk (optional). */
  deletedBy?: string;
  /** The deletion timestamp of the risk (optional). */
  deletedAt?: Date;
}

/**
 * Data transfer object for creating a new risk.
 */
export interface CreateRisk {
  /** Foreign key to Project. */
  projectId: string; // Foreign key to Project
  /** The description of the risk. */
  description: string;
  /** The impact level of the risk. */
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  /** The likelihood of the risk occurring. */
  likelihood: 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'IMMINENT' | 'ALMOST_CERTAIN' | 'CERTAIN' | 'NOT_APPLICABLE' | 'UNKNOWN'; 
  /** The status of the risk. */
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  /** The resolution of the risk (optional). */
  resolution?: 'PENDING' |'ACCEPTED' | 'MITIGATED' |'ESCALATED' | 'AVOIDED';
  /** The mitigation plan for the risk (optional). */
  mitigationPlan?: string;
  /** The owner of the risk (optional). */
  riskOwner?: string; // Assuming this is a user profile ID
  /** The user who created the risk. */
  createdBy: string;
}

/**
 * Data transfer object for querying risks.
 */
export interface QueryRisk {
  /** Optional filter by project ID. */
  projectId?: string; // Optional filter by project ID
  /** Optional filter by description. */
  description?: string;
  /** Optional filter by impact. */
  impact?: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Optional filter by likelihood. */
  likelihood?: 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'IMMINENT' | 'ALMOST_CERTAIN' | 'CERTAIN' | 'NOT_APPLICABLE' | 'UNKNOWN'; 
  /** Optional filter by status. */
  status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  /** Optional filter by resolution. */
  resolution?: 'PENDING' |'ACCEPTED' | 'MITIGATED' |'ESCALATED' | 'AVOIDED';
  /** Optional filter by risk owner. */
  riskOwner?: string; // Assuming this is a user profile ID
  /** Optional creation date range. */
  createdAt?: [Date, Date]; // Range for createdAt
  /** Optional update date range. */
  updatedAt?: [Date, Date]; // Range for updatedAt
  /** Optional filter by creator. */
  createdBy?: string;
  /** Optional filter by updater. */
  updatedBy?: string;
  /** Optional filter by deletion status. */
  deleted?: boolean; 
}

// src/app/models/change.model.ts
/**
 * Represents a change entity.
 */
export interface Change {
  /** The unique identifier of the change. */
  id: string; // uuid
  /** Foreign key to Project. */
  projectId: string; // Foreign key to Project
  /** The type of change. */
  changeType: 'ADDITION' | 'MODIFICATION' | 'DELETION'; 
  /** The status of the change. */
  changeStatus: 'PENDING' | 'RESEARCHING' | 'DISCUSSING' | 'DESIGNING' | 'PENDING_APPROVAL' | 'IMPELEMENTING' | 'COMPLETE' | 'DISCARDED'; 
  /** The description of the change. */
  changeDescription: string;
  /** The date of the change. */
  changeDate: Date;
  /** The requestor of the change. */
  requestor: string;
  /** The approver of the change (optional). */
  approver?: string;
  /** The resolution of the change. */
  resolution: 'PENDING' | 'APPROVED' | 'REJECTED'; 
  /** The user who last updated the change (optional). */
  updatedBy?: string;
  /** The last update timestamp of the change (optional). */
  updatedAt?: Date;
}

/**
 * Data transfer object for creating a new change.
 */
export interface CreateChange {
  /** Foreign key to Project. */
  projectId: string; // Foreign key to Project
  /** The type of change. */
  changeType: 'ADDITION' | 'MODIFICATION' | 'DELETION'; 
  /** The status of the change. */
  changeStatus: 'PENDING' | 'RESEARCHING' | 'DISCUSSING' | 'DESIGNING' | 'PENDING_APPROVAL' | 'IMPELEMENTING' | 'COMPLETE' | 'DISCARDED'; 
  /** The description of the change. */
  changeDescription: string;
  /** The date of the change. */
  changeDate: Date;
  /** The requestor of the change. */
  requestor: string;
  /** The approver of the change (optional). */
  approver?: string;
  /** The resolution of the change. */
  resolution: 'PENDING' | 'APPROVED' | 'REJECTED'; 
}

/**
 * Data transfer object for querying changes.
 */
export interface QueryChange {
  /** Optional filter by project ID. */
  projectId?: string; // Optional filter by project ID
  /** Optional filter by change type. */
  changeType?: 'ADDITION' | 'MODIFICATION' | 'DELETION';
  /** Optional filter by change status. */
  changeStatus?: 'PENDING' | 'RESEARCHING' | 'DISCUSSING' | 'DESIGNING' | 'PENDING_APPROVAL' | 'IMPELEMENTING' | 'COMPLETE' | 'DISCARDED';
  /** Optional filter by change description. */
  changeDescription?: string;
  /** Optional change date range. */
  changeDate?: [Date, Date]; // Range for changeDate
  /** Optional filter by requestor. */
  requestor?: string;
  /** Optional filter by approver. */
  approver?: string;
  /** Optional filter by resolution. */
  resolution?: 'PENDING' | 'APPROVED' | 'REJECTED';
  /** Creation date range. */
  createdAt: [Date, Date]; 
  /** Update date range. */
  updatedAt: [Date, Date]; 
  /** Optional filter by creator. */
  createdBy?: string;
  /** Optional filter by updater. */
  updatedBy?: string;
  /** Optional filter by deletion status. */
  deleted?: boolean; 
}

// src/app/models/project-journal.model.ts
/**
 * Represents a project journal entry entity.
 */
export interface ProjectJournal {
  /** The unique identifier of the journal entry. */
  id: string; // uuid
  /** Foreign key to Project. */
  projectId: string; // Foreign key to Project
  /** The ID of the user profile associated with the entry. */
  profileId: string; // Assuming this links to a user profile
  /** The content of the journal entry. */
  content: string; // text
  /** The creation timestamp of the journal entry. */
  createdAt: Date;
  /** AI analysis of the journal entry (optional). */
  analysis?: string; // AI analysis
  /** The user who last updated the journal entry (optional). */
  updatedBy?: string;
  /** The last update timestamp of the journal entry (optional). */
  updatedAt?: Date;
  /** The user who deleted the journal entry (optional). */
  deletedBy?: string;
  /** The deletion timestamp of the journal entry (optional). */
  deletedAt?: Date;
}

/**
 * Data transfer object for creating a new project journal entry.
 */
export interface CreateProjectJournal {
  /** Foreign key to Project. */
  projectId: string; // Foreign key to Project
  /** The ID of the user profile associated with the entry. */
  profileId: string; // Assuming this links to a user profile
  /** The content of the journal entry. */
  content: string; // text
  /** The creation timestamp of the journal entry. */
  createdAt: Date;
}

/**
 * Data transfer object for querying project journal entries.
 */
export interface QueryProjectJournal {
  /** Optional filter by project ID. */
  projectId?: string; // Optional filter by project ID
  /** Optional filter by profile ID. */
  profileId?: string; // Optional filter by user profile ID
  /** Optional filter by content. */
  content?: string; // Optional filter by content
  /** Optional creation date range. */
  createdAt?: [Date, Date]; // Range for createdAt
  /** Optional update date range. */
  updatedAt?: [Date, Date]; // Range for updatedAt
  /** Optional filter by creator. */
  createdBy?: string;
  /** Optional filter by updater. */
  updatedBy?: string;
  /** Optional filter by deletion status. */
  deleted?: boolean; 
}
