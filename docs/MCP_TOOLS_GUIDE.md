# ForgeOfWill MCP Tools Documentation

## Overview

The ForgeOfWill MCP (Model Context Protocol) Tools provide a comprehensive set of capabilities for AI assistants to interact with the project management system and collaborate with other AI personas.

## Architecture

The MCP tools are implemented in the Gateway service using the `@nestjs-mcp/server` package. This provides a standardized interface for AI assistants to:

1. Manage projects, tasks, risks, changes, and journal entries
2. Discover and refer to other AI specialist personas
3. Collaborate across different AI capabilities

## Available MCP Tools

### Project Management Tools

#### `list_projects`
Lists all projects for a specific user.

**Parameters:**
- `userId` (required): The ID of the user whose projects to list

**Returns:**
- Array of projects with full details
- Count of projects

#### `get_project`
Retrieves detailed information about a specific project.

**Parameters:**
- `projectId` (required): The ID of the project

**Returns:**
- Complete project details including tasks, risks, changes, and journal entries

#### `create_project`
Creates a new project.

**Parameters:**
- `name` (required): Project name
- `description` (required): Project description
- `userId` (required): User creating the project
- `status` (required): Project status (PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED)
- `startDate` (optional): Project start date
- `members` (optional): Array of member IDs

**Returns:**
- Created project object

#### `update_project`
Updates an existing project.

**Parameters:**
- `projectId` (required): Project to update
- `userId` (required): User making the update
- `name`, `description`, `status`, `endDate` (optional): Fields to update

**Returns:**
- Updated project object

#### `delete_project`
Deletes a project.

**Parameters:**
- `projectId` (required): Project to delete
- `userId` (required): User deleting the project

### Task Management Tools

#### `list_tasks`
Lists all tasks for a project.

**Parameters:**
- `projectId` (required): The project ID

#### `create_task`
Creates a new task.

**Parameters:**
- `projectId` (required): Project ID
- `name` (required): Task name
- `description` (required): Task description
- `userId` (required): User creating the task
- `status` (required): Task status (TODO, IN_PROGRESS, BLOCKED, DONE, ARCHIVED)
- `priority` (optional): Task priority (LOW, MEDIUM, HIGH, CRITICAL)
- `assignedTo` (optional): User ID assigned to task
- `dueDate` (optional): Task due date

#### `update_task` / `delete_task`
Update or delete existing tasks.

### Risk Management Tools

#### `list_risks`
Lists all risks for a project.

#### `create_risk`
Creates a new risk.

**Parameters:**
- `projectId` (required): Project ID
- `name` (required): Risk name
- `description` (required): Risk description
- `userId` (required): User creating the risk
- `impact` (required): Impact level (LOW, MEDIUM, HIGH, CRITICAL)
- `probability` (required): Probability (LOW, MEDIUM, HIGH)
- `status` (required): Status (IDENTIFIED, ASSESSED, MITIGATED, CLOSED)
- `mitigation` (optional): Mitigation strategy

### Change Management Tools

#### `list_changes`
Lists all change requests for a project.

#### `create_change`
Creates a new change request.

**Parameters:**
- `projectId` (required): Project ID
- `changeName` (required): Change name
- `changeDescription` (required): Change description
- `userId` (required): User creating the change
- `changeStatus` (required): Status (PROPOSED, APPROVED, IN_PROGRESS, COMPLETE, DISCARDED)
- `priority` (optional): Priority level
- `impact` (optional): Impact description

### Journal Management Tools

#### `list_journal_entries`
Lists all journal entries for a project.

#### `create_journal_entry`
Creates a new journal entry.

**Parameters:**
- `projectId` (required): Project ID
- `profileId` (required): Profile ID
- `entry` (required): Entry content
- `userId` (required): User creating the entry
- `entryDate` (optional): Entry date

### AI Persona Collaboration Tools

#### `list_ai_personas`
Lists all available AI personas/assistants.

**Parameters:**
- `specialty` (optional): Filter by specialty

**Returns:**
- Array of personas with their capabilities

#### `get_ai_persona`
Gets detailed information about a specific AI persona.

**Parameters:**
- `personaId` or `personaName`: Identifier for the persona

**Returns:**
- Complete persona details including skills, expertise, goals, strengths, and limitations

#### `find_specialist_persona`
Finds the most appropriate AI specialist for a given requirement.

**Parameters:**
- `requirement` (required): Description of the task or requirement
- `skillsNeeded` (optional): Array of required skills

**Returns:**
- Ranked list of recommended personas with match scores

**Example Use Cases:**
- "I need help with React development"
- "Need a specialist in project risk assessment"
- "Looking for UI/UX design expertise"

#### `refer_to_persona`
Generates a referral message to introduce another AI persona to the user.

**Parameters:**
- `personaId` (required): Persona to refer to
- `reason` (required): Reason for the referral
- `userQuery` (optional): Original user query

**Returns:**
- Formatted referral message explaining why the user should connect with the specialist

## Usage Examples

### Example 1: AI Assistant Creating a Project

```typescript
// AI receives user request: "Create a new project called 'Mobile App' for developing our iOS app"

// AI calls MCP tool:
const result = await create_project({
  name: "Mobile App",
  description: "Development of our company iOS application",
  userId: "user-123",
  status: "PLANNING",
  startDate: "2025-01-15"
});

// AI responds: "I've created the project 'Mobile App' for you. Would you like me to add some initial tasks?"
```

### Example 2: AI Assistant Referring to a Specialist

```typescript
// AI receives: "I need help designing the user interface for my app"

// AI finds specialist:
const specialists = await find_specialist_persona({
  requirement: "UI/UX design for mobile app",
  skillsNeeded: ["UI design", "mobile", "user experience"]
});

// AI generates referral:
const referral = await refer_to_persona({
  personaId: specialists.recommendedPersonas[0].id,
  reason: "This persona specializes in UI/UX design and has extensive mobile app experience",
  userQuery: "I need help designing the user interface for my app"
});

// AI responds with the generated referral message
```

### Example 3: AI Assistant Managing Tasks

```typescript
// AI receives: "Add a task to implement user authentication"

const task = await create_task({
  projectId: "project-456",
  name: "Implement User Authentication",
  description: "Add JWT-based authentication to the mobile app",
  userId: "user-123",
  status: "TODO",
  priority: "HIGH",
  dueDate: "2025-02-01"
});
```

## Integration with AI Orchestrator

The MCP tools work in conjunction with the AI Orchestrator service:

1. **User sends message** → Chat Gateway → AI Orchestrator
2. **AI Orchestrator** processes message and determines which MCP tools to call
3. **MCP Tools** execute the requested operations via Gateway
4. **Results** flow back through AI Orchestrator to user via Chat Gateway

## Security Considerations

- All MCP tool calls require a `userId` parameter for audit trails
- Tools validate user permissions through the existing AuthGuard
- All operations are logged for security auditing
- Persona referrals preserve user privacy - no sensitive data is shared

## Future Enhancements

Potential future additions to the MCP toolset:

1. **Batch Operations**: Create multiple tasks/risks at once
2. **Analytics Tools**: Generate project health reports
3. **Timeline Tools**: Manage project schedules and dependencies
4. **Collaboration Tools**: Manage team communications
5. **Resource Tools**: Allocate and track resources
6. **AI Learning**: Personas learn from interactions to improve recommendations

## Troubleshooting

### MCP Tools Not Available

If MCP tools are not working:
1. Verify `@nestjs-mcp/server` package is installed
2. Check that `McpToolsModule` is imported in `AppModule`
3. Ensure all required services (PROJECT_PLANNING_SERVICE, TELOS_DOCS_SERVICE) are configured

### Persona Referrals Not Finding Matches

If `find_specialist_persona` returns no matches:
1. Verify TELOS-docs service has personas seeded
2. Check that persona metadata includes skills and specialty fields
3. Try broader search terms or fewer required skills

## Support

For issues or questions about MCP tools:
- Check the AI Orchestrator logs for detailed error messages
- Review Gateway logs for MCP tool execution traces
- Consult the TELOS-docs service for persona availability
