import { UseGuards, Controller, Inject, Get, Param, Post, Body, Patch, Delete } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { ServiceTokens, ProjectCommands, ChangeCommands, ProjectJournalCommands, RiskCommands, TaskCommands, TimerCommands } from "@optimistic-tanuki/constants";
import { QueryProjectDto, CreateProjectDto, UpdateProjectDto, QueryChangeDto, CreateChangeDto, UpdateChangeDto, QueryProjectJournalDto, CreateProjectJournalDto, UpdateProjectJournalDto, QueryRiskDto, CreateRiskDto, UpdateRiskDto, QueryTaskDto, CreateTaskDto, UpdateTaskDto, CreateTimerDto, UpdateTimerDto } from "@optimistic-tanuki/models";
import { firstValueFrom } from "rxjs";
import { AuthGuard } from "../../auth/auth.guard";

/**
 * Controller for handling project planning related API requests.
 */
@UseGuards(AuthGuard)
@Controller('project-planning')
export class ProjectPlanningController {
    /**
     * Creates an instance of ProjectPlanningController.
     * @param projectPlanningService Client proxy for the project planning microservice.
     */
    constructor(@Inject(ServiceTokens.PROJECT_PLANNING_SERVICE) private readonly projectPlanningService: ClientProxy) {}

    /**
     * Finds a project by its ID.
     * @param id The ID of the project to find.
     * @returns A Promise that resolves to the found project.
     */
    @Get('projects/:id')
    async findProjectById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.FIND_ONE }, { id } ));
    }

    /**
     * Finds all projects.
     * @returns A Promise that resolves to an array of projects.
     */
    @Get('projects')
    async findAllProjects() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.FIND_ALL }, {}));
    }

    /**
     * Queries projects based on the provided criteria.
     * @param query The query criteria.
     * @returns A Promise that resolves to an array of projects matching the criteria.
     */
    @Post('projects/query')
    async queryProjects(@Body() query: QueryProjectDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.FIND_ALL }, query));
    }

    /**
     * Creates a new project.
     * @param createProjectDto The data for creating the project.
     * @returns A Promise that resolves to the created project.
     */
    @Post('projects')
    async createProject(@Body() createProjectDto: CreateProjectDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.CREATE }, { ...createProjectDto }));
    }

    /**
     * Updates an existing project.
     * @param updateProjectDto The data for updating the project.
     * @returns A Promise that resolves to the updated project.
     */
    @Patch('projects')
    async updateProject(@Body() updateProjectDto: UpdateProjectDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.UPDATE }, updateProjectDto));
    }

    /**
     * Deletes a project by its ID.
     * @param id The ID of the project to delete.
     * @returns A Promise that resolves when the project is deleted.
     */
    @Delete('projects/:id')
    async deleteProject(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectCommands.DELETE }, { id }));
    }

    /**
     * Finds a change by its ID.
     * @param id The ID of the change to find.
     * @returns A Promise that resolves to the found change.
     */
    @Get('changes/:id')
    async findChangeById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.FIND_ONE }, { id }));
    }

    /**
     * Finds all changes.
     * @returns A Promise that resolves to an array of changes.
     */
    @Get('changes')
    async findAllChanges() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.FIND_ALL }, {}));
    }

    /**
     * Queries changes based on the provided criteria.
     * @param query The query criteria.
     * @returns A Promise that resolves to an array of changes matching the criteria.
     */
    @Post('changes/query')
    async queryChanges(@Body() query: QueryChangeDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.FIND_ALL }, query));
    }

    /**
     * Creates a new change.
     * @param createChangeDto The data for creating the change.
     * @returns A Promise that resolves to the created change.
     */
    @Post('changes')
    async createChange(@Body() createChangeDto: CreateChangeDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.CREATE }, createChangeDto));
    }

    /**
     * Updates an existing change.
     * @param updateChangeDto The data for updating the change.
     * @returns A Promise that resolves to the updated change.
     */
    @Patch('changes')
    async updateChange(@Body() updateChangeDto: UpdateChangeDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.UPDATE }, updateChangeDto));
    }

    /**
     * Deletes a change by its ID.
     * @param id The ID of the change to delete.
     * @returns A Promise that resolves when the change is deleted.
     */
    @Delete('changes/:id')
    async deleteChange(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ChangeCommands.REMOVE }, { id }));
    }

    /**
     * Finds a journal entry by its ID.
     * @param id The ID of the journal entry to find.
     * @returns A Promise that resolves to the found journal entry.
     */
    @Get('journal/:id')
    async findJournalById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.FIND_ONE }, { id }));
    }

    /**
     * Finds all journal entries.
     * @returns A Promise that resolves to an array of journal entries.
     */
    @Get('journal')
    async findAllJournals() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.FIND_ALL }, {}));
    }

    /**
     * Queries journal entries based on the provided criteria.
     * @param query The query criteria.
     * @returns A Promise that resolves to an array of journal entries matching the criteria.
     */
    @Post('journal/query')
    async queryJournals(@Body() query: QueryProjectJournalDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.FIND_ALL }, query));
    }

    /**
     * Creates a new journal entry.
     * @param createChangeDto The data for creating the journal entry.
     * @returns A Promise that resolves to the created journal entry.
     */
    @Post('journal')
    async createJournal(@Body() createChangeDto: CreateProjectJournalDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.CREATE }, createChangeDto));
    }

    /**
     * Updates an existing journal entry.
     * @param updateChangeDto The data for updating the journal entry.
     * @returns A Promise that resolves to the updated journal entry.
     */
    @Patch('journal')
    async updateJournal(@Body() updateChangeDto: UpdateProjectJournalDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.UPDATE }, updateChangeDto));
    }

    /**
     * Deletes a journal entry by its ID.
     * @param id The ID of the journal entry to delete.
     * @returns A Promise that resolves when the journal entry is deleted.
     */
    @Delete('journal/:id')
    async deleteJournal(@Param('id') id: string) {
        console.log("🚀 ~ ProjectPlanningController ~ deleteJournal ~ id:", id)
        return await firstValueFrom(this.projectPlanningService.send({ cmd: ProjectJournalCommands.REMOVE }, { id }));
    }

    /**
     * Finds a risk by its ID.
     * @param id The ID of the risk to find.
     * @returns A Promise that resolves to the found risk.
     */
    @Get('risk/:id')
    async findRiskById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.FIND_ONE }, { id }));
    }

    /**
     * Finds all risks.
     * @returns A Promise that resolves to an array of risks.
     */
    @Get('risk')
    async findAllRisks() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.FIND_ALL }, {}));
    }

    /**
     * Queries risks based on the provided criteria.
     * @param query The query criteria.
     * @returns A Promise that resolves to an array of risks matching the criteria.
     */
    @Post('risk/query')
    async queryRisks(@Body() query: QueryRiskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.FIND_ALL }, query));
    }

    /**
     * Creates a new risk.
     * @param createChangeDto The data for creating the risk.
     * @returns A Promise that resolves to the created risk.
     */
    @Post('risk')
    async createRisk(@Body() createChangeDto: CreateRiskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.CREATE }, createChangeDto));
    }

    /**
     * Updates an existing risk.
     * @param updateChangeDto The data for updating the risk.
     * @returns A Promise that resolves to the updated risk.
     */
    @Patch('risk')
    async updateRisk(@Body() updateChangeDto: UpdateRiskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.UPDATE }, updateChangeDto));
    }

    /**
     * Deletes a risk by its ID.
     * @param id The ID of the risk to delete.
     * @returns A Promise that resolves when the risk is deleted.
     */
    @Delete('risk/:id')
    async deleteRisk(@Param('id') id: string) {
        console.log("🚀 ~ ProjectPlanningController ~ deleteRisk ~ id:", id)
        return await firstValueFrom(this.projectPlanningService.send({ cmd: RiskCommands.DELETE }, { id }));
    }

    /**
     * Finds a task by its ID.
     * @param id The ID of the task to find.
     * @returns A Promise that resolves to the found task.
     */
    @Get('tasks/:id')
    async findTaskById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.FIND_ONE }, { id }));
    }

    /**
     * Finds all tasks.
     * @returns A Promise that resolves to an array of tasks.
     */
    @Get('tasks')
    async findAllTasks() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.FIND_ALL }, {}));
    }

    /**
     * Queries tasks based on the provided criteria.
     * @param query The query criteria.
     * @returns A Promise that resolves to an array of tasks matching the criteria.
     */
    @Post('tasks/query')
    async queryTasks(@Body() query: QueryTaskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.FIND_ALL }, query));
    }

    /**
     * Creates a new task.
     * @param createChangeDto The data for creating the task.
     * @returns A Promise that resolves to the created task.
     */
    @Post('tasks')
    async createTask(@Body() createChangeDto: CreateTaskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.CREATE }, createChangeDto));
    }

    /**
     * Updates an existing task.
     * @param updateChangeDto The data for updating the task.
     * @returns A Promise that resolves to the updated task.
     */
    @Patch('tasks')
    async updateTask(@Body() updateChangeDto: UpdateTaskDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.UPDATE }, updateChangeDto));
    }

    /**
     * Deletes a task by its ID.
     * @param id The ID of the task to delete.
     * @returns A Promise that resolves when the task is deleted.
     */
    @Delete('tasks/:id')
    async deleteTask(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TaskCommands.DELETE }, { id }));
    }

    /**
     * Finds a timer by its ID.
     * @param id The ID of the timer to find.
     * @returns A Promise that resolves to the found timer.
     */
    @Get('timers/:id')
    async findTimerById(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.FIND_ONE }, { id }));
    }

    /**
     * Finds all timers.
     * @returns A Promise that resolves to an array of timers.
     */
    @Get('timers')
    async findAllTimers() {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.FIND_ALL }, {}));
    }

    /**
     * Creates a new timer.
     * @param createChangeDto The data for creating the timer.
     * @returns A Promise that resolves to the created timer.
     */
    @Post('timers')
    async createTimer(@Body() createChangeDto: CreateTimerDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.CREATE }, createChangeDto));
    }

    /**
     * Updates an existing timer.
     * @param updateChangeDto The data for updating the timer.
     * @returns A Promise that resolves to the updated timer.
     */
    @Patch('timers')
    async updateTimer(@Body() updateChangeDto: UpdateTimerDto) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.UPDATE }, updateChangeDto));
    }

    /**
     * Deletes a timer by its ID.
     * @param id The ID of the timer to delete.
     * @returns A Promise that resolves when the timer is deleted.
     */
    @Delete('timers/:id')
    async deleteTimer(@Param('id') id: string) {
        return await firstValueFrom(this.projectPlanningService.send({ cmd: TimerCommands.DELETE }, { id }));
    }
}