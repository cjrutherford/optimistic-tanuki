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

// src/app/models/task.model.ts
export interface Task {
  id: string; // uuid
  projectId: string; // Foreign key to Project
  title: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Completed' | 'Blocked';
  assignee: string; // Assuming 'createdBy' in ER is 'assignee' for task context
  dueDate: Date; // Added based on wireframe display
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  deletedBy?: string;
  deletedAt?: Date;
}

// src/app/models/timer.model.ts
export interface Timer {
  id: string; // uuid
  taskId: string; // Foreign key to Task
  status: 'Running' | 'Paused' | 'Stopped';
  startTime: Date;
  endTime?: Date;
  elapsedTime: number; // in seconds
  updatedBy?: string;
  updatedAt?: Date;
  deletedBy?: string;
  deletedAt?: Date;
}

// src/app/models/risk.model.ts
export interface Risk {
  id: string; // uuid
  projectId: string; // Foreign key to Project
  description: string;
  impact: 'Low' | 'Medium' | 'High';
  likelihood: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Mitigated' | 'Closed';
  resolution?: 'Resolved' | 'Accepted' | 'Transferred'; // Renamed from 'resolution' to avoid conflict with status
  mitigationPlan?: string;
  riskOwner?: string; // Added based on ER
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  deletedBy?: string;
  deletedAt?: Date;
}

// src/app/models/change.model.ts
export interface Change {
  id: string; // uuid
  projectId: string; // Foreign key to Project
  changeType: 'Scope' | 'Schedule' | 'Cost' | 'Resource' | 'Other';
  changeDescription: string;
  changeDate: Date;
  requestor: string;
  approver?: string;
  resolution: 'Pending' | 'Approved' | 'Rejected'; // Renamed from 'resolution' to avoid conflict with status
  updatedBy?: string;
  updatedAt?: Date;
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
