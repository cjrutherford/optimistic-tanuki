import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  AIOrchestrationCommands,
  ProfileCommands,
  PersonaTelosCommands,
  ProjectCommands,
  TaskCommands,
  RiskCommands,
} from '@optimistic-tanuki/constants';

describe('AI Orchestrator Microservice E2E Tests', () => {
  let client: ClientProxy;
  let profileClient: ClientProxy;
  let telosClient: ClientProxy;
  let projectPlanningClient: ClientProxy;

  let createdProfileId: string;
  let personaId: string;
  let createdProjectId: string;
  let createdTaskId: string;
  let createdRiskId: string;

  // Shared history for the conversation
  let history: any[] = [];
  const conversationId = 'e2e-test-conversation-' + Date.now();
  const projectName = 'Project Omega ' + Date.now();

  beforeAll(async () => {
    // 1. Initialize Clients
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: 'localhost', port: 3010 },
    });

    profileClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: 'localhost', port: 3002 },
    });

    telosClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: 'localhost', port: 3008 },
    });

    projectPlanningClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: 'localhost', port: 3006 },
    });

    // 2. Wait for connections
    const clients = [client, profileClient, telosClient, projectPlanningClient];
    for (const c of clients) {
      for (let i = 0; i < 30; i++) {
        try {
          await c.connect();
          break;
        } catch (err) {
          console.log(`Connection attempt ${i + 1} failed, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
    console.log('Connected to all services');

    // 3. Get Persona ID
    try {
      const personas = await firstValueFrom(
        telosClient.send(
          { cmd: PersonaTelosCommands.FIND },
          { name: 'Alex Generalis' }
        )
      );
      if (personas && personas.length > 0) {
        personaId = personas[0].id;
        console.log('Found persona:', personaId);
      } else {
        console.warn('No persona found with name "Alex Generalis"');
      }
    } catch (e) {
      console.warn('Failed to find persona', e);
    }

    // 4. Create Profile
    const profileData = {
      userId: 'test-user-id-' + Date.now(),
      name: 'Test User',
      bio: 'Test Bio',
      profilePic: 'http://example.com/avatar.jpg',
      coverPic: 'http://example.com/cover.jpg',
      description: 'Test Description',
      location: 'Test Location',
      occupation: 'Test Occupation',
      interests: 'Test Interests',
      skills: 'Test Skills',
    };

    try {
      const profile = await firstValueFrom(
        profileClient.send({ cmd: ProfileCommands.Create }, profileData)
      );
      createdProfileId = profile.id;
      console.log('Created profile:', createdProfileId);
    } catch (e) {
      console.warn('Failed to create profile', e);
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup Project
    try {
      let projectIdToDelete = createdProjectId;

      // If no ID captured yet, try to find by name to ensure cleanup
      if (!projectIdToDelete && createdProfileId) {
        try {
          const projects = await firstValueFrom(
            projectPlanningClient.send(
              { cmd: ProjectCommands.FIND_ALL },
              { name: projectName, owner: createdProfileId }
            )
          );
          if (projects && projects.length > 0) {
            projectIdToDelete = projects[0].id;
            console.log(
              'Found orphaned project to cleanup:',
              projectIdToDelete
            );
          }
        } catch (err) {
          console.warn('Failed to search for orphaned project', err);
        }
      }

      if (projectIdToDelete) {
        await firstValueFrom(
          projectPlanningClient.send(
            { cmd: ProjectCommands.REMOVE },
            projectIdToDelete
          )
        );
        console.log('Cleaned up project:', projectIdToDelete);
      }
    } catch (e) {
      console.warn('Failed to cleanup project', e);
    }

    // Close connections
    if (client) await client.close();
    if (profileClient) await profileClient.close();
    if (telosClient) await telosClient.close();
    if (projectPlanningClient) await projectPlanningClient.close();
  });

  // Helper to send message to AI
  const sendMessage = async (content: string) => {
    const persona = {
      id: personaId || 'default-persona-id',
      name: 'Alex Generalis',
      role: 'assistant',
      description: 'An AI assistant',
      coreObjective: 'Help the user',
      goals: [],
      skills: [],
      limitations: [],
    };

    const userMessage = {
      id: 'msg-' + Date.now(),
      conversationId,
      senderName: 'Test User',
      senderId: createdProfileId,
      recipientId: [createdProfileId],
      recipientName: ['Test User'],
      content,
      timestamp: new Date(),
      role: 'user',
      type: 'chat',
    };

    const conversation = {
      id: conversationId,
      participants: [createdProfileId],
      messages: [...history, userMessage],
      privacy: 'private',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const payload = {
      conversation,
      aiPersonas: [persona],
    };

    const result = await firstValueFrom(
      client.send({ cmd: AIOrchestrationCommands.CONVERSATION_UPDATE }, payload)
    );

    // Update history
    history.push(userMessage);
    if (Array.isArray(result)) {
      history.push(...result);
    }

    return result;
  };

  it('Step 1: Should create a project', async () => {
    const response = await sendMessage(
      `Create a new project named "${projectName}" with description "Top secret project". IMPORTANT: Please explicitly state the Project ID in your response.`
    );

    // Log response
    console.log(
      'Full AI Response (Step 1):',
      JSON.stringify(response, null, 2)
    );
    const aiResponse = [...response]
      .reverse()
      .find(
        (m: any) =>
          m.role === 'assistant' ||
          m.senderName === 'Assistant' ||
          m.senderName === 'Alex Generalis'
      );
    console.log('AI Response (Create):', aiResponse?.content);
    expect(aiResponse).toBeDefined();

    // Verify in DB with retry
    let projects: any[] = [];
    for (let i = 0; i < 15; i++) {
      try {
        // Search by name only, as the owner ID might differ if the AI/Tool logic uses a different context
        projects = await firstValueFrom(
          projectPlanningClient.send(
            { cmd: ProjectCommands.FIND_ALL },
            { name: projectName }
          )
        );
        if (projects && projects.length > 0) break;
      } catch (e) {
        console.log(`Attempt ${i + 1} to find project failed, retrying...`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    expect(projects).toBeDefined();
    expect(projects.length).toBeGreaterThan(0);
    createdProjectId = projects[0].id;
    console.log('Verified Project in DB:', createdProjectId);
    console.log('Project Owner:', projects[0].owner);
    console.log('Expected Owner:', createdProfileId);
    expect(projects[0].description).toBe('Top secret project');
  }, 300000);

  it('Step 2: Should add a task to the project', async () => {
    expect(createdProjectId).toBeDefined();

    const response = await sendMessage(
      `Add a task "Initial Research" to ${projectName}. Use the Project ID: ${createdProjectId}.`
    );

    console.log(
      'Full AI Response (Step 2):',
      JSON.stringify(response, null, 2)
    );
    const aiResponse = [...response]
      .reverse()
      .find(
        (m: any) =>
          m.role === 'assistant' ||
          m.senderName === 'Assistant' ||
          m.senderName === 'Alex Generalis'
      );
    console.log('AI Response (Add Task):', aiResponse?.content);
    expect(aiResponse).toBeDefined();

    // Verify in DB with retry
    let tasks: any[] = [];
    for (let i = 0; i < 10; i++) {
      try {
        tasks = await firstValueFrom(
          projectPlanningClient.send(
            { cmd: TaskCommands.FIND_ALL },
            { projectId: createdProjectId }
          )
        );
        if (tasks && tasks.find((t: any) => t.title === 'Initial Research'))
          break;
      } catch (e) {
        console.log(`Attempt ${i + 1} to find task failed, retrying...`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    expect(tasks).toBeDefined();
    const task = tasks.find((t: any) => t.title === 'Initial Research');
    expect(task).toBeDefined();
    createdTaskId = task.id;
    console.log('Verified Task in DB:', createdTaskId);
    expect(task.status).toBe('TODO'); // Default status
  }, 300000);

  it('Step 3: Should add a risk to the project', async () => {
    expect(createdProjectId).toBeDefined();

    const response = await sendMessage(
      `Add a risk "Budget Overrun" to Project Omega (ID: ${createdProjectId}). Set status to "OPEN".`
    );

    console.log(
      'Full AI Response (Step 3):',
      JSON.stringify(response, null, 2)
    );
    const aiResponse = [...response]
      .reverse()
      .find(
        (m: any) =>
          m.role === 'assistant' ||
          m.senderName === 'Assistant' ||
          m.senderName === 'Alex Generalis'
      );
    console.log('AI Response (Add Risk):', aiResponse?.content);
    expect(aiResponse).toBeDefined();

    // Verify in DB with retry
    let risks: any[] = [];
    for (let i = 0; i < 15; i++) {
      try {
        risks = await firstValueFrom(
          projectPlanningClient.send(
            { cmd: RiskCommands.FIND_ALL },
            { projectId: createdProjectId }
          )
        );
        if (risks && risks.find((r: any) => r.name === 'Budget Overrun'))
          break;
      } catch (e) {
        console.log(`Attempt ${i + 1} to find risk failed, retrying...`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    expect(risks).toBeDefined();
    const risk = risks.find((r: any) => r.name === 'Budget Overrun');
    expect(risk).toBeDefined();
    createdRiskId = risk.id;
    console.log('Verified Risk in DB:', createdRiskId);
    expect(risk.status).toBe('OPEN'); // Default status
  }, 300000);

  it('Step 4: Should summarize the project', async () => {
    expect(createdProjectId).toBeDefined();

    const response = await sendMessage(
      `Summarize the status of "${projectName}". Use the Project ID: ${createdProjectId} to fetch details.`
    );

    console.log(
      'Full AI Response (Step 4):',
      JSON.stringify(response, null, 2)
    );
    const aiResponse = [...response]
      .reverse()
      .find(
        (m: any) =>
          m.role === 'assistant' ||
          m.senderName === 'Assistant' ||
          m.senderName === 'Alex Generalis'
      );
    console.log('AI Response (Summarize):', aiResponse?.content);
    expect(aiResponse).toBeDefined();

    // Check if summary contains key elements
    const content = aiResponse.content.toLowerCase();
    expect(content).toContain(projectName.toLowerCase());
    expect(content).toContain('initial research'); // Task
    expect(content).toContain('budget overrun'); // Risk
  }, 300000);
});
