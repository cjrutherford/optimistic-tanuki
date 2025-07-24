import { Controller, Inject, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ChangeCommands, ProjectCommands, ProjectJournalCommands, RiskCommands, ServiceTokens, TaskCommands, TimerCommands } from '@optimistic-tanuki/constants';
import { CreateChangeDto, CreateProjectDto, CreateProjectJournalDto, CreateRiskDto, CreateTaskDto, CreateTimerDto, QueryChangeDto, QueryProjectDto, QueryProjectJournalDto, QueryRiskDto, QueryTaskDto, UpdateChangeDto, UpdateProjectDto, UpdateProjectJournalDto, UpdateRiskDto, UpdateTaskDto, UpdateTimerDto } from '@optimistic-tanuki/models';

@Controller('project-planning')
export class ProjectPlanningController {
    constructor(@Inject(ServiceTokens.PROJECT_PLANNING_SERVICE) private readonly projectPlanningService: ClientProxy) {}

    @Get('projects/:id')
    async findProjectById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.FIND_ONE }, { id } ));
    }

    @Get('projects')
    async findAllProjects() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.FIND_ALL }, {}));
    }

    @Post('projects/query')
    async queryProjects(@Body() query: QueryProjectDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.FIND_ALL }, query));
    }

    @Post('projects')
    async createProject(@Body() createProjectDto: CreateProjectDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.CREATE }, createProjectDto));
    }

    @Patch('projects')
    async updateProject(@Body() updateProjectDto: UpdateProjectDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.UPDATE }, updateProjectDto));
    }

    @Delete('projects/:id')
    async deleteProject(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.DELETE }, { id }));
    }

    @Get('changes/:id')
    async findChangeById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.FIND_ONE }, { id }));
    }

    @Get('changes')
    async findAllChanges() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.FIND_ALL }, {}));
    }

    @Post('changes/query')
    async queryChanges(@Body() query: QueryChangeDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.FIND_ALL }, query));
    }

    @Post('changes')
    async createChange(@Body() createChangeDto: CreateChangeDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.CREATE }, createChangeDto));
    }

    @Patch('changes')
    async updateChange(@Body() updateChangeDto: UpdateChangeDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.UPDATE }, updateChangeDto));
    }

    @Delete('changes/:id')
    async deleteChange(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.DELETE }, { id }));
    }

    @Get('journal/:id')
    async findJournalById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.FIND_ONE }, { id }));
    }

    @Get('journal')
    async findAllJournals() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.FIND_ALL }, {}));
    }

    @Post('journal/query')
    async queryJournals(@Body() query: QueryProjectJournalDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.FIND_ALL }, query));
    }

    @Post('journal')
    async createJournal(@Body() createChangeDto: CreateProjectJournalDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.CREATE }, createChangeDto));
    }

    @Patch('journal')
    async updateJournal(@Body() updateChangeDto: UpdateProjectJournalDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.UPDATE }, updateChangeDto));
    }

    @Delete('journal/:id')
    async deleteJournal(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.DELETE }, { id }));
    }

    @Get('risk/:id')
    async findRiskById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.FIND_ONE }, { id }));
    }

    @Get('risk')
    async findAllRisks() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.FIND_ALL }, {}));
    }

    @Post('risk/query')
    async queryRisks(@Body() query: QueryRiskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.FIND_ALL }, query));
    }

    @Post('risk')
    async createRisk(@Body() createChangeDto: CreateRiskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.CREATE }, createChangeDto));
    }

    @Patch('risk')
    async updateRisk(@Body() updateChangeDto: UpdateRiskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.UPDATE }, updateChangeDto));
    }

    @Delete('risk/:id')
    async deleteRisk(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.DELETE }, { id }));
    }

    @Get('tasks/:id')
    async findTaskById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.FIND_ONE }, { id }));
    }

    @Get('tasks')
    async findAllTasks() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.FIND_ALL }, {}));
    }

    @Post('tasks/query')
    async queryTasks(@Body() query: QueryTaskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.FIND_ALL }, query));
    }

    @Post('tasks')
    async createTask(@Body() createChangeDto: CreateTaskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.CREATE }, createChangeDto));
    }

    @Patch('tasks')
    async updateTask(@Body() updateChangeDto: UpdateTaskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.UPDATE }, updateChangeDto));
    }

    @Delete('tasks/:id')
    async deleteTask(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.DELETE }, { id }));
    }

    @Get('timers/:id')
    async findTimerById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.FIND_ONE }, { id }));
    }

    @Get('timers')
    async findAllTimers() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.FIND_ALL }, {}));
    }

    @Post('timers')
    async createTimer(@Body() createChangeDto: CreateTimerDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.CREATE }, createChangeDto));
    }

    @Patch('timers')
    async updateTimer(@Body() updateChangeDto: UpdateTimerDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.UPDATE }, updateChangeDto));
    }

    @Delete('timers/:id')
    async deleteTimer(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.DELETE }, { id }));
    }
}