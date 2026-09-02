import {
  Controller,
  Inject,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ChangeCommands,
  AnalyticsCommands,
  ProjectCommands,
  ProjectInviteCommands,
  ProjectJournalCommands,
  RiskCommands,
  ServiceTokens,
  TaskCommands,
  TaskNoteCommands,
  TaskTimeEntryCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateChangeDto,
  CreateProjectDto,
  CreateProjectJournalDto,
  CreateRiskDto,
  CreateTaskDto,
  CreateTaskNoteDto,
  CreateTaskTimeEntryDto,
  QueryChangeDto,
  QueryProjectDto,
  QueryProjectJournalDto,
  QueryRiskDto,
  QueryTaskDto,
  QueryTaskNoteDto,
  QueryTaskTimeEntryDto,
  UpdateChangeDto,
  UpdateProjectDto,
  UpdateProjectJournalDto,
  UpdateRiskDto,
  UpdateTaskDto,
  UpdateTaskNoteDto,
  UpdateTaskTimeEntryDto,
  CreateAiChangeDto,
  ReviewAiChangeDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { ProjectAiCommands } from '@optimistic-tanuki/constants';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { ModelBound } from '../../decorators/request-timeout.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProjectInviteMailer } from './project-invite.mailer';

@UseGuards(AuthGuard, PermissionsGuard)
@ApiTags('project-planning')
@Controller('project-planning')
export class ProjectPlanningController {
  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiOrchestrationService: ClientProxy,
    private readonly inviteMailer: ProjectInviteMailer
  ) {}

  /**
   * A model's read of one project.
   *
   * Model bound, because a summary takes roughly 23 seconds against the
   * configured analysis model and the gateway's ordinary timeout is 30. A
   * route that answers an error while the work succeeds is worse than a slow
   * one: the caller and the system end up disagreeing about what happened.
   *
   * The project is fetched here and passed to the orchestrator rather than
   * having it fetch by id. project-planning owns the data and decides who may
   * read it, so the authorisation question is answered once, by the same
   * permission check every other route on this controller uses.
   */
  @ApiOperation({ summary: 'A model-written summary of one project' })
  @RequirePermissions('project-planning.project.read')
  @ModelBound()
  @Get('projects/:id/summary')
  async summariseProject(@User() user: UserDetails, @Param('id') id: string) {
    const project = await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.FIND_ONE },
        { id, requestingUserId: user.profileId }
      )
    );

    if (!project) {
      return {
        summary: null,
        model: null,
        discarded: 0,
        unavailable: 'That project could not be read.',
      };
    }

    return await firstValueFrom(
      this.aiOrchestrationService.send(
        { cmd: ProjectAiCommands.SUMMARISE },
        { project }
      )
    );
  }

  @ApiOperation({ summary: 'Find project by ID' })
  @ApiResponse({ status: 200, description: 'Project found' })
  @RequirePermissions('project-planning.project.read')
  @Get('projects/:id')
  async findProjectById(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.FIND_ONE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find all projects' })
  @ApiResponse({ status: 200, description: 'Projects retrieved' })
  @RequirePermissions('project-planning.project.read')
  @Get('projects')
  async findAllProjects(@User() user: UserDetails) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.FIND_ALL },
        { requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Query projects' })
  @ApiResponse({ status: 200, description: 'Projects retrieved' })
  @RequirePermissions('project-planning.project.read')
  @Post('projects/query')
  async queryProjects(
    @User() user: UserDetails,
    @Body() query: QueryProjectDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.FIND_ALL },
        { ...query, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @RequirePermissions('project-planning.project.create')
  @Post('projects')
  async createProject(
    @User() user: UserDetails,
    @Body() createProjectDto: CreateProjectDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.CREATE },
        {
          ...createProjectDto,
          // Both, and after the spread. owner came straight from the
          // body, so a caller could create a project owned by somebody
          // else and drop it into their workspace. Ownership follows
          // whoever is signed in; handing a project over is its own
          // operation with its own check.
          owner: user.profileId,
          createdBy: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Update a project' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @RequirePermissions('project-planning.project.update')
  @Patch('projects')
  async updateProject(
    @User() user: UserDetails,
    @Body() updateProjectDto: UpdateProjectDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.UPDATE },
        {
          ...updateProjectDto,
          updatedBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a project' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @RequirePermissions('project-planning.project.delete')
  @Delete('projects/:id')
  async deleteProject(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.REMOVE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  /**
   * Asks a model what this project is missing, and files each answer for
   * approval.
   *
   * Nothing is applied here. Every proposal lands as a pending change, and a
   * person decides. That is the whole point of the feature: the agent argues,
   * the human agrees.
   *
   * Model bound for the same reason as the summary. The gateway's ordinary
   * timeout is 30 seconds and this takes longer, and a route that reports a
   * failure while the work succeeds leaves the caller and the system
   * disagreeing about what happened.
   */
  @ApiOperation({ summary: 'Ask a model to propose changes to a project' })
  @RequirePermissions('project-planning.project.update')
  @ModelBound()
  @Post('projects/:id/ai-proposals')
  async proposeAiChanges(@User() user: UserDetails, @Param('id') id: string) {
    const project = await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.FIND_ONE },
        { id, requestingUserId: user.profileId }
      )
    );

    if (!project) {
      return {
        proposals: [],
        model: null,
        discarded: 0,
        unavailable: 'That project could not be read.',
      };
    }

    const result = await firstValueFrom(
      this.aiOrchestrationService.send(
        { cmd: ProjectAiCommands.PROPOSE },
        { project }
      )
    );

    const filed = [];
    for (const proposal of result?.proposals ?? []) {
      filed.push(
        await firstValueFrom(
          this.projectPlanningService.send(
            { cmd: ProjectCommands.CREATE_AI_CHANGE },
            {
              projectId: id,
              proposedBy: user.profileId,
              operation: proposal.operation,
              payload: proposal.payload,
              reason: proposal.reason,
            }
          )
        )
      );
    }

    return {
      model: result?.model ?? null,
      discarded: result?.discarded ?? 0,
      unavailable: result?.unavailable,
      changes: filed,
    };
  }

  /**
   * Tells an agent to do something on this project.
   *
   * The caller's own bearer token goes through to the orchestrator, which uses
   * it to open an MCP session and act as them. Nothing here decides what the
   * agent may touch: the MCP tools answer that from who is asking, and the
   * approval gate lives on those tools, so an agent on a project that requires
   * approval files proposals instead of writing.
   *
   * Model bound. An agent loop is several model calls and several tool calls,
   * which is well past the gateway's ordinary 30 seconds.
   */
  @ApiOperation({ summary: 'Have an agent work on a project through MCP' })
  @RequirePermissions('project-planning.project.update')
  @ModelBound()
  @Post('projects/:id/ai-act')
  async actOnProject(
    @Param('id') id: string,
    @Body()
    body: {
      instruction?: string;
      history?: { role: 'person' | 'assistant'; text: string }[];
      personaId?: string | null;
    },
    @Req() request: { credential?: string }
  ) {
    // From the guard rather than the headers. The browser signs in with a
    // cookie, so reading the Authorization header meant this route worked for
    // a script and failed for every real user.
    const token = request.credential;
    if (!token) {
      throw new BadRequestException('A signed in caller is required to act.');
    }
    if (!body?.instruction?.trim()) {
      throw new BadRequestException('An instruction is required.');
    }

    return await firstValueFrom(
      this.aiOrchestrationService.send(
        { cmd: ProjectAiCommands.ACT },
        {
          instruction: body.instruction,
          projectId: id,
          token,
          // The thread is held by whoever is having the conversation. Keeping
          // it here would mean deciding whose it is and when it ends, for a
          // panel that already knows both.
          history: body.history ?? [],
          // Carried here as well as on the streaming route. This one is not
          // what the panel calls, and a route that quietly ignored the chosen
          // persona would answer as the wrong person with nothing to show for
          // it.
          personaId: body.personaId ?? null,
        }
      )
    );
  }

  /**
   * Where the time went, per task and per tag.
   *
   * The service behind this existed with no route, and carried a note saying
   * to add ownership scoping before exposing it. That has been done, and every
   * call carries the caller so the figures cover only projects they are part
   * of.
   *
   * Worth having only since time entries started recording real durations.
   * Every one of these numbers would have been zero before that.
   */
  @ApiOperation({ summary: "A project's time and tag figures" })
  @RequirePermissions('project-planning.project.read')
  @Get('projects/:id/analytics')
  async projectAnalytics(@User() user: UserDetails, @Param('id') id: string) {
    const query = { projectId: id, requestingUserId: user.profileId };
    const [project, tags] = await Promise.all([
      firstValueFrom(
        this.projectPlanningService.send(
          { cmd: AnalyticsCommands.GET_PROJECT_ANALYTICS },
          query
        )
      ),
      firstValueFrom(
        this.projectPlanningService.send(
          { cmd: AnalyticsCommands.GET_TAG_ANALYTICS },
          query
        )
      ),
    ]);

    return { project, tags };
  }

  /**
   * The same run, streamed, so the panel is not silent for a minute.
   *
   * Written to the response as it arrives rather than through @Sse, because
   * that decorator is GET only and EventSource cannot carry a request body.
   * The instruction and the thread belong in a body, so this stays a POST and
   * writes newline-delimited JSON that a reader can parse a line at a time.
   *
   * Model bound for the same reason as the unstreamed version: the work behind
   * it is unchanged, only its reporting.
   */
  @ApiOperation({
    summary: 'Have an agent work on a project, reporting as it goes',
  })
  @RequirePermissions('project-planning.project.update')
  @ModelBound()
  @Post('projects/:id/ai-act/stream')
  async actOnProjectStreaming(
    @Param('id') id: string,
    @Body()
    body: {
      instruction?: string;
      history?: { role: 'person' | 'assistant'; text: string }[];
    },
    @Req() request: { credential?: string },
    @Res() response: Response
  ) {
    return this.streamAgent(id, body, request, response);
  }

  /**
   * One run, written out as it happens, with or without a project.
   *
   * Newline-delimited JSON rather than @Sse, because that decorator is GET only
   * and EventSource cannot carry a request body. The instruction and the thread
   * belong in a body, so this stays a POST.
   */
  private async streamAgent(
    projectId: string | null,
    body: {
      instruction?: string;
      history?: { role: 'person' | 'assistant'; text: string }[];
      personaId?: string | null;
    },
    request: { credential?: string },
    response: Response
  ) {
    const token = request.credential;
    if (!token) {
      throw new BadRequestException('A signed in caller is required to act.');
    }
    if (!body?.instruction?.trim()) {
      throw new BadRequestException('An instruction is required.');
    }

    response.setHeader('Content-Type', 'application/x-ndjson');
    response.setHeader('Cache-Control', 'no-cache');
    // Proxies that buffer would hold every line until the end, which is the
    // silence this exists to remove.
    response.setHeader('X-Accel-Buffering', 'no');

    await new Promise<void>((resolve) => {
      this.aiOrchestrationService
        .send(
          { cmd: ProjectAiCommands.ACT_STREAM },
          {
            instruction: body.instruction,
            projectId,
            token,
            history: body.history ?? [],
            // Absent means the persona whose job is running projects, chosen
            // by the orchestrator rather than named here.
            personaId: body.personaId ?? null,
          }
        )
        .subscribe({
          next: (event) => response.write(`${JSON.stringify(event)}\n`),
          error: (error) => {
            // The reader always ends with something to show, so a failure here
            // has to look like a finished run rather than a dropped connection.
            response.write(
              `${JSON.stringify({
                type: 'done',
                result: {
                  said: '',
                  used: [],
                  awaitingApproval: false,
                  model: null,
                  unavailable: `The assistant could not be reached: ${error.message}`,
                },
              })}\n`
            );
            response.end();
            resolve();
          },
          complete: () => {
            response.end();
            resolve();
          },
        });
    });
  }

  /**
   * The assistant with no project chosen yet.
   *
   * The same run as the route above, without an id. Away from a project the
   * assistant is not useless, it is starting further back: listing projects
   * needs no project id, so it can find its way to one and say what it found.
   *
   * The approval gate is unaffected. It lives on the tools and keys off the
   * project each tool is acting on, so nothing here decides what may be
   * touched.
   */
  @ApiOperation({ summary: 'Have an agent work, with no project chosen yet' })
  @RequirePermissions('project-planning.project.read')
  @ModelBound()
  @Post('ai-act/stream')
  async actAnywhereStreaming(
    @Body()
    body: {
      instruction?: string;
      projectId?: string | null;
      history?: { role: 'person' | 'assistant'; text: string }[];
      personaId?: string | null;
    },
    @Req() request: { credential?: string },
    @Res() response: Response
  ) {
    return this.streamAgent(body?.projectId ?? null, body, request, response);
  }

  /**
   * Inviting somebody to work on a project.
   *
   * The identity is the session's profile, never anything the caller sent. The
   * service refuses everyone but the owner, and refuses in the same words as
   * being unable to reach the project at all, so these routes cannot be used
   * to find out which projects exist.
   */
  @ApiOperation({ summary: 'Invite somebody to a project' })
  @RequirePermissions('project-planning.project.update')
  @Post('projects/:id/invites')
  async inviteToProject(
    @User() user: UserDetails,
    @Param('id') projectId: string,
    @Body() body: { email?: string }
  ) {
    if (!body?.email?.trim()) {
      throw new BadRequestException('An email address is required.');
    }
    const invite = await firstValueFrom(
      this.projectPlanningService.send<{ email: string; token: string }>(
        { cmd: ProjectInviteCommands.CREATE },
        {
          projectId,
          email: body.email,
          requestingUserId: user.profileId,
        }
      )
    );

    // After the record exists, and never allowed to undo it. The invitation is
    // discoverable inside the application by whoever it was addressed to, so a
    // failure to send costs a courtesy rather than the invitation.
    const project = await firstValueFrom(
      this.projectPlanningService.send<{ name?: string } | null>(
        { cmd: ProjectCommands.FIND_ONE },
        { id: projectId, requestingUserId: user.profileId }
      )
    ).catch(() => null);

    await this.inviteMailer.send({
      email: invite.email,
      token: invite.token,
      projectName: project?.name,
      invitedByName: user.name,
      appId: 'forgeofwill',
    });

    return invite;
  }

  @ApiOperation({ summary: 'List the invitations on a project' })
  @RequirePermissions('project-planning.project.update')
  @Get('projects/:id/invites')
  async findProjectInvites(
    @User() user: UserDetails,
    @Param('id') projectId: string
  ) {
    // Guarded as tightly as inviting. An invitation carries an email address,
    // and who is working on a project is not public.
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectInviteCommands.FIND_FOR_PROJECT },
        { projectId, requestingUserId: user.profileId }
      )
    );
  }

  /**
   * The three below are the invitee's side, and every one of them is scoped by
   * the caller's own email from the session rather than by anything they sent.
   * An invitation id is not a secret; the address it was sent to is what makes
   * it theirs.
   */
  @ApiOperation({ summary: 'Invitations waiting on the signed in caller' })
  @RequirePermissions('project-planning.project.read')
  @Get('invitations')
  async findMyInvitations(@User() user: UserDetails) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectInviteCommands.FIND_FOR_ME },
        { email: user.email, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'One invitation, by the token in its link' })
  @RequirePermissions('project-planning.project.read')
  @Get('invitations/:token')
  async findInvitationByToken(
    @User() user: UserDetails,
    @Param('token') token: string
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectInviteCommands.FIND_BY_TOKEN },
        { token, email: user.email, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Accept or decline an invitation' })
  @RequirePermissions('project-planning.project.read')
  @Patch('invitations/:id')
  async respondToInvitation(
    @User() user: UserDetails,
    @Param('id') id: string,
    @Body() body: { accept?: boolean }
  ) {
    if (typeof body?.accept !== 'boolean') {
      throw new BadRequestException(
        'An answer of accept true or false is required.'
      );
    }
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectInviteCommands.RESPOND },
        {
          id,
          accept: body.accept,
          email: user.email,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Withdraw an invitation' })
  @RequirePermissions('project-planning.project.update')
  @Delete('projects/invites/:inviteId')
  async revokeProjectInvite(
    @User() user: UserDetails,
    @Param('inviteId') inviteId: string
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectInviteCommands.REVOKE },
        { id: inviteId, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'List AI-proposed project changes awaiting review' })
  @RequirePermissions('project-planning.project.read')
  @Get('projects/:id/ai-changes')
  async findAiChanges(
    @User() user: UserDetails,
    @Param('id') projectId: string
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.FIND_AI_CHANGES },
        { projectId, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({
    summary: 'Submit an AI-proposed project mutation for approval',
  })
  @RequirePermissions('project-planning.project.update')
  @Post('projects/:id/ai-changes')
  async createAiChange(
    @User() user: UserDetails,
    @Param('id') projectId: string,
    @Body() dto: Omit<CreateAiChangeDto, 'projectId' | 'proposedBy'>
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.CREATE_AI_CHANGE },
        {
          ...dto,
          projectId,
          proposedBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({
    summary: 'Approve or reject an AI-proposed project mutation',
  })
  @RequirePermissions('project-planning.project.update')
  @Patch('projects/ai-changes/:id')
  async reviewAiChange(
    @User() user: UserDetails,
    @Param('id') id: string,
    @Body() dto: Omit<ReviewAiChangeDto, 'id'>
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.REVIEW_AI_CHANGE },
        {
          ...dto,
          id,
          reviewedBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Find change by ID' })
  @ApiResponse({ status: 200, description: 'Change found' })
  @RequirePermissions('project-planning.change.read')
  @Get('changes/:id')
  async findChangeById(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ChangeCommands.FIND_ONE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find all changes' })
  @ApiResponse({ status: 200, description: 'Changes retrieved' })
  @RequirePermissions('project-planning.change.read')
  @Get('changes')
  async findAllChanges(@User() user: UserDetails) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ChangeCommands.FIND_ALL },
        { requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Query changes' })
  @ApiResponse({ status: 200, description: 'Changes retrieved' })
  @RequirePermissions('project-planning.change.read')
  @Post('changes/query')
  async queryChanges(@User() user: UserDetails, @Body() query: QueryChangeDto) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ChangeCommands.FIND_ALL },
        { ...query, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Create a new change' })
  @ApiResponse({ status: 201, description: 'Change created successfully' })
  @RequirePermissions('project-planning.change.create')
  @Post('changes')
  async createChange(
    @User() user: UserDetails,
    @Body() createChangeDto: CreateChangeDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ChangeCommands.CREATE },
        {
          ...createChangeDto,
          // ChangeService derives requestor, approver and createdBy from
          // requestor alone.
          requestor: user.profileId,
          createdBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Update a change' })
  @ApiResponse({ status: 200, description: 'Change updated successfully' })
  @RequirePermissions('project-planning.change.update')
  @Patch('changes')
  async updateChange(
    @User() user: UserDetails,
    @Body() updateChangeDto: UpdateChangeDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ChangeCommands.UPDATE },
        {
          ...updateChangeDto,
          updatedBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a change' })
  @ApiResponse({ status: 200, description: 'Change deleted successfully' })
  @RequirePermissions('project-planning.change.delete')
  @Delete('changes/:id')
  async deleteChange(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ChangeCommands.REMOVE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find journal entry by ID' })
  @ApiResponse({ status: 200, description: 'Journal entry found' })
  @RequirePermissions('project-planning.journal.read')
  @Get('journal/:id')
  async findJournalById(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.FIND_ONE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find all journal entries' })
  @ApiResponse({ status: 200, description: 'Journal entries retrieved' })
  @RequirePermissions('project-planning.journal.read')
  @Get('journal')
  async findAllJournals(@User() user: UserDetails) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.FIND_ALL },
        { requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Query journal entries' })
  @ApiResponse({ status: 200, description: 'Journal entries retrieved' })
  @RequirePermissions('project-planning.journal.read')
  @Post('journal/query')
  async queryJournals(
    @User() user: UserDetails,
    @Body() query: QueryProjectJournalDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.FIND_ALL },
        { ...query, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Create a journal entry' })
  @ApiResponse({
    status: 201,
    description: 'Journal entry created successfully',
  })
  @RequirePermissions('project-planning.journal.create')
  @Post('journal')
  async createJournal(
    @User() user: UserDetails,
    @Body() createJournalDto: CreateProjectJournalDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.CREATE },
        {
          ...createJournalDto,
          // The journal service reads profileId, not createdBy. Setting
          // the wrong name meant identity never arrived unless the client
          // sent it, and the client did not.
          profileId: user.profileId,
          createdBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Update a journal entry' })
  @ApiResponse({
    status: 200,
    description: 'Journal entry updated successfully',
  })
  @RequirePermissions('project-planning.journal.update')
  @Patch('journal')
  async updateJournal(
    @User() user: UserDetails,
    @Body() updateJournalDto: UpdateProjectJournalDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.UPDATE },
        {
          ...updateJournalDto,
          updatedBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a journal entry' })
  @ApiResponse({
    status: 200,
    description: 'Journal entry deleted successfully',
  })
  @RequirePermissions('project-planning.journal.delete')
  @Delete('journal/:id')
  async deleteJournal(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.REMOVE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find risk by ID' })
  @ApiResponse({ status: 200, description: 'Risk found' })
  @RequirePermissions('project-planning.risk.read')
  @Get('risk/:id')
  async findRiskById(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: RiskCommands.FIND_ONE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find all risks' })
  @ApiResponse({ status: 200, description: 'Risks retrieved' })
  @RequirePermissions('project-planning.risk.read')
  @Get('risk')
  async findAllRisks(@User() user: UserDetails) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: RiskCommands.FIND_ALL },
        { requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Query risks' })
  @ApiResponse({ status: 200, description: 'Risks retrieved' })
  @RequirePermissions('project-planning.risk.read')
  @Post('risk/query')
  async queryRisks(@User() user: UserDetails, @Body() query: QueryRiskDto) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: RiskCommands.FIND_ALL },
        { ...query, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Create a new risk' })
  @ApiResponse({ status: 201, description: 'Risk created successfully' })
  @RequirePermissions('project-planning.risk.create')
  @Post('risk')
  async createRisk(
    @User() user: UserDetails,
    @Body() createRiskDto: CreateRiskDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: RiskCommands.CREATE },
        {
          ...createRiskDto,
          // RiskService uses riskOwner as the owner and as createdBy.
          riskOwner: user.profileId,
          createdBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Update a risk' })
  @ApiResponse({ status: 200, description: 'Risk updated successfully' })
  @RequirePermissions('project-planning.risk.update')
  @Patch('risk')
  async updateRisk(
    @User() user: UserDetails,
    @Body() updateRiskDto: UpdateRiskDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: RiskCommands.UPDATE },
        {
          ...updateRiskDto,
          updatedBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a risk' })
  @ApiResponse({ status: 200, description: 'Risk deleted successfully' })
  @RequirePermissions('project-planning.risk.delete')
  @Delete('risk/:id')
  async deleteRisk(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: RiskCommands.DELETE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find task by ID' })
  @ApiResponse({ status: 200, description: 'Task found' })
  @RequirePermissions('project-planning.task.read')
  @Get('tasks/:id')
  async findTaskById(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskCommands.FIND_ONE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find all tasks' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved' })
  @RequirePermissions('project-planning.task.read')
  @Get('tasks')
  async findAllTasks(@User() user: UserDetails) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskCommands.FIND_ALL },
        { requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Query tasks' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved' })
  @RequirePermissions('project-planning.task.read')
  @Post('tasks/query')
  async queryTasks(@User() user: UserDetails, @Body() query: QueryTaskDto) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskCommands.FIND_ALL },
        { ...query, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @RequirePermissions('project-planning.task.create')
  @Post('tasks')
  async createTask(
    @User() user: UserDetails,
    @Body() createTaskDto: CreateTaskDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskCommands.CREATE },
        {
          ...createTaskDto,
          createdBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @RequirePermissions('project-planning.task.update')
  @Patch('tasks')
  async updateTask(
    @User() user: UserDetails,
    @Body() updateTaskDto: UpdateTaskDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskCommands.UPDATE },
        {
          ...updateTaskDto,
          updatedBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @RequirePermissions('project-planning.task.delete')
  @Delete('tasks/:id')
  async deleteTask(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskCommands.DELETE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  // Task Notes endpoints
  @ApiOperation({ summary: 'Find task note by ID' })
  @ApiResponse({ status: 200, description: 'Task note found' })
  @RequirePermissions('project-planning.task-note.read')
  @Get('task-notes/:id')
  async findTaskNoteById(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.FIND_ONE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find all task notes' })
  @ApiResponse({ status: 200, description: 'Task notes retrieved' })
  @RequirePermissions('project-planning.task-note.read')
  @Get('task-notes')
  async findAllTaskNotes(@User() user: UserDetails) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.FIND_ALL },
        { requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Query task notes' })
  @ApiResponse({ status: 200, description: 'Task notes retrieved' })
  @RequirePermissions('project-planning.task-note.read')
  @Post('task-notes/query')
  async queryTaskNotes(
    @User() user: UserDetails,
    @Body() query: QueryTaskNoteDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.FIND_ALL },
        { ...query, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Create a task note' })
  @ApiResponse({
    status: 201,
    description: 'Task note created successfully',
  })
  @RequirePermissions('project-planning.task-note.create')
  @Post('task-notes')
  async createTaskNote(
    @User() user: UserDetails,
    @Body() createTaskNoteDto: CreateTaskNoteDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.CREATE },
        {
          ...createTaskNoteDto,
          profileId: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Update a task note' })
  @ApiResponse({
    status: 200,
    description: 'Task note updated successfully',
  })
  @RequirePermissions('project-planning.task-note.update')
  @Patch('task-notes')
  async updateTaskNote(
    @User() user: UserDetails,
    @Body() updateTaskNoteDto: UpdateTaskNoteDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.UPDATE },
        {
          ...updateTaskNoteDto,
          updatedBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a task note' })
  @ApiResponse({
    status: 200,
    description: 'Task note deleted successfully',
  })
  @RequirePermissions('project-planning.task-note.delete')
  @Delete('task-notes/:id')
  async deleteTaskNote(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.REMOVE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  // Task Time Entry endpoints
  @ApiOperation({ summary: 'Find task time entry by ID' })
  @ApiResponse({ status: 200, description: 'Task time entry found' })
  @RequirePermissions('project-planning.task-time-entry.read')
  @Get('task-time-entries/:id')
  async findTaskTimeEntryById(
    @User() user: UserDetails,
    @Param('id') id: string
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskTimeEntryCommands.FIND_ONE },
        { id, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Find all task time entries' })
  @ApiResponse({ status: 200, description: 'Task time entries retrieved' })
  @RequirePermissions('project-planning.task-time-entry.read')
  @Get('task-time-entries')
  async findAllTaskTimeEntries(@User() user: UserDetails) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskTimeEntryCommands.FIND_ALL },
        { requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Query task time entries' })
  @ApiResponse({ status: 200, description: 'Task time entries retrieved' })
  @RequirePermissions('project-planning.task-time-entry.read')
  @Post('task-time-entries/query')
  async queryTaskTimeEntries(
    @User() user: UserDetails,
    @Body() query: QueryTaskTimeEntryDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskTimeEntryCommands.FIND_ALL },
        { ...query, requestingUserId: user.profileId }
      )
    );
  }

  /**
   * Stops a running time entry.
   *
   * The service could always do this and nothing could reach it: stopping was
   * done through update, which meant the client decided the duration. It sent
   * only an end time, so every finished entry recorded zero seconds. Here the
   * server reads the clock, which is the only way the number means anything.
   */
  @ApiOperation({ summary: 'Start a time entry on a task' })
  @ApiResponse({
    status: 201,
    description: 'Task time entry created successfully',
  })
  @RequirePermissions('project-planning.task-time-entry.create')
  @Post('task-time-entries')
  async createTaskTimeEntry(
    @User() user: UserDetails,
    @Body() createTaskTimeEntryDto: CreateTaskTimeEntryDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskTimeEntryCommands.CREATE },
        {
          ...createTaskTimeEntryDto,
          createdBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Update a task time entry' })
  @ApiResponse({
    status: 200,
    description: 'Task time entry updated successfully',
  })
  @RequirePermissions('project-planning.task-time-entry.update')
  @Patch('task-time-entries')
  async updateTaskTimeEntry(
    @User() user: UserDetails,
    @Body() updateTaskTimeEntryDto: UpdateTaskTimeEntryDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskTimeEntryCommands.UPDATE },
        {
          ...updateTaskTimeEntryDto,
          updatedBy: user.profileId,
          requestingUserId: user.profileId,
        }
      )
    );
  }

  @ApiOperation({ summary: 'Stop a running time entry' })
  @ApiResponse({ status: 200, description: 'Time entry stopped' })
  @RequirePermissions('project-planning.task-time-entry.update')
  @Patch('task-time-entries/:id/stop')
  async stopTaskTimeEntry(@User() user: UserDetails, @Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskTimeEntryCommands.STOP },
        { id, updatedBy: user.profileId, requestingUserId: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a task time entry' })
  @ApiResponse({
    status: 200,
    description: 'Task time entry deleted successfully',
  })
  @RequirePermissions('project-planning.task-time-entry.delete')
  @Delete('task-time-entries/:id')
  async deleteTaskTimeEntry(
    @User() user: UserDetails,
    @Param('id') id: string
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskTimeEntryCommands.REMOVE },
        { id, requestingUserId: user.profileId }
      )
    );
  }
}
