// src/app/models/project.model.ts
export interface Project {
  id: string; // uuid
  owner: string;
  members: string[];
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: string; // e.g., 'Active', 'Completed', 'On Hold'
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  deletedBy?: string;
  deletedAt?: Date;
  tasks: Task[]; // Array of Task objects
  risks: Risk[]; // Array of Risk objects
  changes: Change[]; // Array of Change objects
  journalEntries: ProjectJournal[]; // Array of ProjectJournal objects
  timers: Timer[]; // Array of Timer objects
}

export interface CreateProject {
  owner: string;
  members: string[];
  name: string;
  description: string;
  status: string;
  startDate: Date;
  endDate?: Date;
}

export interface QueryProject {
    owner: string;
  members: string[];
  name: string;
  description: string;
  createdAt: [Date, Date]; 
  updatedAt: [Date, Date]; 
  createdBy?: string;
  updatedBy?: string;
  deleted?: boolean; 
}

// src/app/models/task.model.ts
export interface Task {
  id: string; // uuid
  projectId: string; // Foreign key to Project
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED'; // Assuming status is a string enum
  priority: 'LOW' | 'MEDIUM_LOW' | 'MEDIUM' | 'MEDIUM_HIGH' | 'HIGH'; // Assuming priority is a string enum
  assignee: string; // Assuming 'createdBy' in ER is 'assignee' for task context
  dueDate: Date; // Added based on wireframe display
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  deletedBy?: string;
  deletedAt?: Date;
}

export interface CreateTask {
  projectId: string; 
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM_LOW' | 'MEDIUM' | 'MEDIUM_HIGH' | 'HIGH'; 
}

export interface QueryTask {
  projectId?: string;
  title?: string;
  description?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
  priority?: 'LOW' | 'MEDIUM_LOW' | 'MEDIUM' | 'MEDIUM_HIGH' | 'HIGH';
  assignee?: string; 
  dueDate?: [Date, Date]; 
  createdAt?: [Date, Date]; 
  updatedAt?: [Date, Date]; 
  createdBy?: string;
  updatedBy?: string;
  deleted?: boolean; 
}

// src/app/models/timer.model.ts
export interface Timer {
  id?: string; // uuid
  taskId: string; 
  status: 'Running' | 'Paused' | 'Stopped';
  startTime: Date;
  endTime?: Date;
  elapsedTime: number; // in seconds
  updatedBy?: string;
  updatedAt?: Date;
  deletedBy?: string;
  deletedAt?: Date;
}

export interface CreateTimer {
  taskId: string; // Foreign key to Task
  status: 'Running' | 'Paused' | 'Stopped';
  startTime: Date;
  endTime?: Date;
  elapsedTime: number; // in seconds
}


// src/app/models/risk.model.ts
export interface Risk {
  id: string; // uuid
  projectId: string; // Foreign key to Project
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  likelihood: 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'IMMINENT' | 'ALMOST_CERTAIN' | 'CERTAIN' | 'NOT_APPLICABLE' | 'UNKNOWN'; 
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  resolution?: 'PENDING' |'ACCEPTED' | 'MITIGATED' |'ESCALATED' | 'AVOIDED';
  mitigationPlan?: string;
  riskOwner?: string; 
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  deletedBy?: string;
  deletedAt?: Date;
}

export interface CreateRisk {
  projectId: string; // Foreign key to Project
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  likelihood: 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'IMMINENT' | 'ALMOST_CERTAIN' | 'CERTAIN' | 'NOT_APPLICABLE' | 'UNKNOWN'; 
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  resolution?: 'PENDING' |'ACCEPTED' | 'MITIGATED' |'ESCALATED' | 'AVOIDED';
  mitigationPlan?: string;
  riskOwner?: string; // Assuming this is a user profile ID
}

export interface QueryRisk {
  projectId?: string; // Optional filter by project ID
  description?: string;
  impact?: 'LOW' | 'MEDIUM' | 'HIGH';
  likelihood?: 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'IMMINENT' | 'ALMOST_CERTAIN' | 'CERTAIN' | 'NOT_APPLICABLE' | 'UNKNOWN'; 
  status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  resolution?: 'PENDING' |'ACCEPTED' | 'MITIGATED' |'ESCALATED' | 'AVOIDED';
  riskOwner?: string; // Assuming this is a user profile ID
  createdAt?: [Date, Date]; // Range for createdAt
  updatedAt?: [Date, Date]; // Range for updatedAt
  createdBy?: string;
  updatedBy?: string;
  deleted?: boolean; 
}

// src/app/models/change.model.ts
export interface Change {
  id: string; // uuid
  projectId: string; // Foreign key to Project
  changeType: 'ADDITION' | 'MODIFICATION' | 'DELETION'; 
  changeStatus: 'PENDING' | 'RESEARCHING' | 'DISCUSSING' | 'DESIGNING' | 'PENDING_APPROVAL' | 'IMPELEMENTING' | 'COMPLETE' | 'DISCARDED'; 
  changeDescription: string;
  changeDate: Date;
  requestor: string;
  approver?: string;
  resolution: 'PENDING' | 'APPROVED' | 'REJECTED'; 
  updatedBy?: string;
  updatedAt?: Date;
}

export interface CreateChange {
  projectId: string; // Foreign key to Project
  changeType: 'ADDITION' | 'MODIFICATION' | 'DELETION'; 
  changeStatus: 'PENDING' | 'RESEARCHING' | 'DISCUSSING' | 'DESIGNING' | 'PENDING_APPROVAL' | 'IMPELEMENTING' | 'COMPLETE' | 'DISCARDED'; 
  changeDescription: string;
  changeDate: Date;
  requestor: string;
  approver?: string;
  resolution: 'PENDING' | 'APPROVED' | 'REJECTED'; 
}

export interface QueryChange {
  projectId?: string; // Optional filter by project ID
  changeType?: 'ADDITION' | 'MODIFICATION' | 'DELETION';
  changeStatus?: 'PENDING' | 'RESEARCHING' | 'DISCUSSING' | 'DESIGNING' | 'PENDING_APPROVAL' | 'IMPELEMENTING' | 'COMPLETE' | 'DISCARDED';
  changeDescription?: string;
  changeDate?: [Date, Date]; // Range for changeDate
  requestor?: string;
  approver?: string;
  resolution?: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: [Date, Date]; 
  updatedAt: [Date, Date]; 
  createdBy?: string;
  updatedBy?: string;
  deleted?: boolean; 
}

// src/app/models/project-journal.model.ts
export interface ProjectJournal {
  id: string; // uuid
  projectId: string; // Foreign key to Project
  profileId: string; // Assuming this links to a user profile
  content: string; // text
  createdAt: Date;
  analysis?: string; // AI analysis
  updatedBy?: string;
  updatedAt?: Date;
  deletedBy?: string;
  deletedAt?: Date;
}

export interface CreateProjectJournal {
  projectId: string; // Foreign key to Project
  profileId: string; // Assuming this links to a user profile
  content: string; // text
  createdAt: Date;
}

export interface QueryProjectJournal {
  projectId?: string; // Optional filter by project ID
  profileId?: string; // Optional filter by profile ID
  content?: string; // Optional filter by content
  createdAt?: [Date, Date]; // Range for createdAt
  updatedAt?: [Date, Date]; // Range for updatedAt
  createdBy?: string;
  updatedBy?: string;
  deleted?: boolean; 
}
