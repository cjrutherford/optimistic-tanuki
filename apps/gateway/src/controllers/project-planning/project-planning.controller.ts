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
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ChangeCommands,
  ProjectCommands,
  ProjectJournalCommands,
  RiskCommands,
  ServiceTokens,
  TaskCommands,
  TaskNoteCommands,
  TimerCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateChangeDto,
  CreateProjectDto,
  CreateProjectJournalDto,
  CreateRiskDto,
  CreateTaskDto,
  CreateTaskNoteDto,
  CreateTimerDto,
  QueryChangeDto,
  QueryProjectDto,
  QueryProjectJournalDto,
  QueryRiskDto,
  QueryTaskDto,
  QueryTaskNoteDto,
  UpdateChangeDto,
  UpdateProjectDto,
  UpdateProjectJournalDto,
  UpdateRiskDto,
  UpdateTaskDto,
  UpdateTaskNoteDto,
  UpdateTimerDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@UseGuards(AuthGuard, PermissionsGuard)
@ApiTags('project-planning')
@Controller('project-planning')
export class ProjectPlanningController {
  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy
  ) {}

  @ApiOperation({ summary: 'Find project by ID' })
  @ApiResponse({ status: 200, description: 'Project found' })
  @RequirePermissions('project-planning.project.read')
  @Get('projects/:id')
  async findProjectById(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectCommands.FIND_ONE },
        { id }
      )
    );
  }

  @ApiOperation({ summary: 'Find all projects' })
  @ApiResponse({ status: 200, description: 'Projects retrieved' })
  @RequirePermissions('project-planning.project.read')
  @Get('projects')
  async findAllProjects() {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: ProjectCommands.FIND_ALL }, {})
    );
  }

  @ApiOperation({ summary: 'Query projects' })
  @ApiResponse({ status: 200, description: 'Projects retrieved' })
  @RequirePermissions('project-planning.project.read')
  @Post('projects/query')
  async queryProjects(@Body() query: QueryProjectDto) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: ProjectCommands.FIND_ALL }, query)
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
        { ...createProjectDto, createdBy: user.profileId }
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
        { ...updateProjectDto, updatedBy: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a project' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @RequirePermissions('project-planning.project.delete')
  @Delete('projects/:id')
  async deleteProject(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: ProjectCommands.DELETE }, { id })
    );
  }

  @ApiOperation({ summary: 'Find change by ID' })
  @ApiResponse({ status: 200, description: 'Change found' })
  @RequirePermissions('project-planning.change.read')
  @Get('changes/:id')
  async findChangeById(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: ChangeCommands.FIND_ONE }, { id })
    );
  }

  @ApiOperation({ summary: 'Find all changes' })
  @ApiResponse({ status: 200, description: 'Changes retrieved' })
  @RequirePermissions('project-planning.change.read')
  @Get('changes')
  async findAllChanges() {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: ChangeCommands.FIND_ALL }, {})
    );
  }

  @ApiOperation({ summary: 'Query changes' })
  @ApiResponse({ status: 200, description: 'Changes retrieved' })
  @RequirePermissions('project-planning.change.read')
  @Post('changes/query')
  async queryChanges(@Body() query: QueryChangeDto) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: ChangeCommands.FIND_ALL }, query)
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
        { ...createChangeDto, createdBy: user.profileId }
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
        { ...updateChangeDto, updatedBy: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a change' })
  @ApiResponse({ status: 200, description: 'Change deleted successfully' })
  @RequirePermissions('project-planning.change.delete')
  @Delete('changes/:id')
  async deleteChange(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: ChangeCommands.REMOVE }, { id })
    );
  }

  @ApiOperation({ summary: 'Find journal entry by ID' })
  @ApiResponse({ status: 200, description: 'Journal entry found' })
  @RequirePermissions('project-planning.journal.read')
  @Get('journal/:id')
  async findJournalById(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.FIND_ONE },
        { id }
      )
    );
  }

  @ApiOperation({ summary: 'Find all journal entries' })
  @ApiResponse({ status: 200, description: 'Journal entries retrieved' })
  @RequirePermissions('project-planning.journal.read')
  @Get('journal')
  async findAllJournals() {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.FIND_ALL },
        {}
      )
    );
  }

  @ApiOperation({ summary: 'Query journal entries' })
  @ApiResponse({ status: 200, description: 'Journal entries retrieved' })
  @RequirePermissions('project-planning.journal.read')
  @Post('journal/query')
  async queryJournals(@Body() query: QueryProjectJournalDto) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.FIND_ALL },
        query
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
        { ...createJournalDto, createdBy: user.profileId }
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
        { ...updateJournalDto, updatedBy: user.profileId }
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
  async deleteJournal(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: ProjectJournalCommands.REMOVE },
        { id }
      )
    );
  }

  @ApiOperation({ summary: 'Find risk by ID' })
  @ApiResponse({ status: 200, description: 'Risk found' })
  @RequirePermissions('project-planning.risk.read')
  @Get('risk/:id')
  async findRiskById(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: RiskCommands.FIND_ONE }, { id })
    );
  }

  @ApiOperation({ summary: 'Find all risks' })
  @ApiResponse({ status: 200, description: 'Risks retrieved' })
  @RequirePermissions('project-planning.risk.read')
  @Get('risk')
  async findAllRisks() {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: RiskCommands.FIND_ALL }, {})
    );
  }

  @ApiOperation({ summary: 'Query risks' })
  @ApiResponse({ status: 200, description: 'Risks retrieved' })
  @RequirePermissions('project-planning.risk.read')
  @Post('risk/query')
  async queryRisks(@Body() query: QueryRiskDto) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: RiskCommands.FIND_ALL }, query)
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
        { ...createRiskDto, createdBy: user.profileId }
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
        { ...updateRiskDto, updatedBy: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a risk' })
  @ApiResponse({ status: 200, description: 'Risk deleted successfully' })
  @RequirePermissions('project-planning.risk.delete')
  @Delete('risk/:id')
  async deleteRisk(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: RiskCommands.DELETE }, { id })
    );
  }

  @ApiOperation({ summary: 'Find task by ID' })
  @ApiResponse({ status: 200, description: 'Task found' })
  @RequirePermissions('project-planning.task.read')
  @Get('tasks/:id')
  async findTaskById(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: TaskCommands.FIND_ONE }, { id })
    );
  }

  @ApiOperation({ summary: 'Find all tasks' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved' })
  @RequirePermissions('project-planning.task.read')
  @Get('tasks')
  async findAllTasks() {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: TaskCommands.FIND_ALL }, {})
    );
  }

  @ApiOperation({ summary: 'Query tasks' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved' })
  @RequirePermissions('project-planning.task.read')
  @Post('tasks/query')
  async queryTasks(@Body() query: QueryTaskDto) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: TaskCommands.FIND_ALL }, query)
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
        { ...createTaskDto, createdBy: user.profileId }
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
        { ...updateTaskDto, updatedBy: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @RequirePermissions('project-planning.task.delete')
  @Delete('tasks/:id')
  async deleteTask(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: TaskCommands.DELETE }, { id })
    );
  }

  @ApiOperation({ summary: 'Find timer by ID' })
  @ApiResponse({ status: 200, description: 'Timer found' })
  @RequirePermissions('project-planning.timer.read')
  @Get('timers/:id')
  async findTimerById(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: TimerCommands.FIND_ONE }, { id })
    );
  }

  @ApiOperation({ summary: 'Find all timers' })
  @ApiResponse({ status: 200, description: 'Timers retrieved' })
  @RequirePermissions('project-planning.timer.read')
  @Get('timers')
  async findAllTimers() {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: TimerCommands.FIND_ALL }, {})
    );
  }

  @ApiOperation({ summary: 'Create a timer' })
  @ApiResponse({ status: 201, description: 'Timer created successfully' })
  @RequirePermissions('project-planning.timer.create')
  @Post('timers')
  async createTimer(
    @User() user: UserDetails,
    @Body() createTimerDto: CreateTimerDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TimerCommands.CREATE },
        { ...createTimerDto, createdBy: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Update a timer' })
  @ApiResponse({ status: 200, description: 'Timer updated successfully' })
  @RequirePermissions('project-planning.timer.update')
  @Patch('timers')
  async updateTimer(
    @User() user: UserDetails,
    @Body() updateTimerDto: UpdateTimerDto
  ) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TimerCommands.UPDATE },
        { ...updateTimerDto, updatedBy: user.profileId }
      )
    );
  }

  @ApiOperation({ summary: 'Delete a timer' })
  @ApiResponse({ status: 200, description: 'Timer deleted successfully' })
  @RequirePermissions('project-planning.timer.delete')
  @Delete('timers/:id')
  async deleteTimer(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send({ cmd: TimerCommands.DELETE }, { id })
    );
  }

  // Task Notes endpoints
  @ApiOperation({ summary: 'Find task note by ID' })
  @ApiResponse({ status: 200, description: 'Task note found' })
  @RequirePermissions('project-planning.task-note.read')
  @Get('task-notes/:id')
  async findTaskNoteById(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.FIND_ONE },
        id
      )
    );
  }

  @ApiOperation({ summary: 'Find all task notes' })
  @ApiResponse({ status: 200, description: 'Task notes retrieved' })
  @RequirePermissions('project-planning.task-note.read')
  @Get('task-notes')
  async findAllTaskNotes() {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.FIND_ALL },
        {}
      )
    );
  }

  @ApiOperation({ summary: 'Query task notes' })
  @ApiResponse({ status: 200, description: 'Task notes retrieved' })
  @RequirePermissions('project-planning.task-note.read')
  @Post('task-notes/query')
  async queryTaskNotes(@Body() query: QueryTaskNoteDto) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.FIND_ALL },
        query
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
        { ...createTaskNoteDto, profileId: user.profileId }
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
        { ...updateTaskNoteDto, updatedBy: user.profileId }
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
  async deleteTaskNote(@Param('id') id: string) {
    return await firstValueFrom(
      this.projectPlanningService.send(
        { cmd: TaskNoteCommands.REMOVE },
        id
      )
    );
  }
}
