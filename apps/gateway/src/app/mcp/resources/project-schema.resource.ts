import { Injectable, Logger } from '@nestjs/common';
import { Resource } from '@rekog/mcp-nest';

@Injectable()
export class ProjectSchemaResource {
  private readonly logger = new Logger(ProjectSchemaResource.name);

  @Resource({
    uri: 'project://schema',
    name: 'Project ER Diagram & Schema',
    mimeType: 'application/json',
    description:
      'Mermaid ER diagram and machine-readable schema describing entities (project, task, risk, change, journalEntry, timer) and their relations.',
  })
  async getProjectSchema() {
    this.logger.log('Providing project ER diagram and schema');

    const mermaid = `
erDiagram
  PROJECT ||--o{ TASK : has
  PROJECT ||--o{ RISK : has
  PROJECT ||--o{ CHANGE : has
  PROJECT ||--o{ JOURNAL_ENTRY : has
  TASK ||--o{ TIMER : has
  TASK }|..|{ USER : assigned
  RISK }|..|{ USER : reported_by
  CHANGE }|..|{ USER : requested_by
  JOURNAL_ENTRY }|..|{ USER : author
`;

    const schema = {
      entities: [
        {
          name: 'project',
          pk: 'id',
          fields: [
            'id',
            'name',
            'description',
            'owner', // user id
            'members', // array of user ids
            'status', // PLANNING|ACTIVE|ON_HOLD|COMPLETED|CANCELLED
            'startDate',
            'endDate',
            'createdAt',
            'updatedAt',
          ],
          indexed: ['owner', 'name'],
          sampleSearchFields: ['name', 'owner'],
        },
        {
          name: 'task',
          pk: 'id',
          fields: [
            'id',
            'projectId',
            'title',
            'description',
            'assigneeId',
            'status',
            'priority',
            'dueDate',
            'estimatedHours',
            'createdAt',
            'updatedAt',
          ],
          fks: [{ field: 'projectId', refs: 'project.id' }],
          indexed: ['projectId', 'assigneeId'],
          sampleSearchFields: ['title', 'assigneeId', 'projectId'],
        },
        {
          name: 'risk',
          pk: 'id',
          fields: [
            'id',
            'projectId',
            'title',
            'description',
            'severity',
            'status',
            'ownerId',
            'mitigation',
            'createdAt',
            'updatedAt',
          ],
          fks: [{ field: 'projectId', refs: 'project.id' }],
          indexed: ['projectId', 'severity'],
          sampleSearchFields: ['title', 'severity', 'projectId'],
        },
        {
          name: 'change',
          pk: 'id',
          fields: [
            'id',
            'projectId',
            'title',
            'description',
            'requestedBy',
            'approvedBy',
            'status',
            'createdAt',
            'updatedAt',
          ],
          fks: [{ field: 'projectId', refs: 'project.id' }],
          indexed: ['projectId', 'status'],
          sampleSearchFields: ['title', 'requestedBy', 'projectId'],
        },
        {
          name: 'journalEntry',
          pk: 'id',
          fields: [
            'id',
            'projectId',
            'authorId',
            'title',
            'body',
            'type',
            'createdAt',
            'updatedAt',
          ],
          fks: [{ field: 'projectId', refs: 'project.id' }],
          indexed: ['projectId', 'authorId'],
          sampleSearchFields: ['title', 'authorId', 'projectId'],
        },
        {
          name: 'timer',
          pk: 'id',
          fields: [
            'id',
            'taskId',
            'projectId',
            'userId',
            'startTime',
            'endTime',
            'durationSeconds',
            'notes',
            'createdAt',
            'updatedAt',
          ],
          fks: [
            { field: 'taskId', refs: 'task.id' },
            { field: 'projectId', refs: 'project.id' },
          ],
          indexed: ['taskId', 'userId', 'projectId'],
          sampleSearchFields: ['taskId', 'userId', 'projectId'],
        },
      ],
      relations: [
        { from: 'task.projectId', to: 'project.id', type: 'many-to-one' },
        { from: 'risk.projectId', to: 'project.id', type: 'many-to-one' },
        { from: 'change.projectId', to: 'project.id', type: 'many-to-one' },
        {
          from: 'journalEntry.projectId',
          to: 'project.id',
          type: 'many-to-one',
        },
        { from: 'timer.taskId', to: 'task.id', type: 'many-to-one' },
        { from: 'timer.projectId', to: 'project.id', type: 'many-to-one' },
      ],
      notes:
        'Use indexed fields for efficient lookups (owner, name, projectId, assigneeId). When resolving projects by name prefer exact then case-insensitive match.',
    };

    return {
      mermaid: mermaid.trim(),
      schema,
      text: mermaid.trim(),
    };
  }
}
