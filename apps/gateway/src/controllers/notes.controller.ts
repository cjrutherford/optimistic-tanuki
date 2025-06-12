import { Controller, Post, Get, Put, Delete, Body, Param, Query, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { CreateNoteDto, SearchNoteDto, UpdateNoteDto } from "@optimistic-tanuki/models";
import { NotesCommands, ServiceTokens } from "@optimistic-tanuki/constants";
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from "@nestjs/swagger";

//TODO: ensure this has proper authenticatioin and authorization guards
@ApiTags('notes')
@Controller('notes')
export class NotesController {

    constructor(@Inject(ServiceTokens.TASKS_SERVICE) private readonly client: ClientProxy) {}

    @Post()
    @ApiOperation({ summary: 'Create a new note' })
    @ApiBody({ type: CreateNoteDto })
    @ApiResponse({ status: 201, description: 'The note has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    async create(@Body() createNoteDto: CreateNoteDto) {
        return this.client.send({ cmd: NotesCommands.CREATE }, createNoteDto);
    }

    @Get()
    @ApiOperation({ summary: 'Retrieve all notes' })
    @ApiQuery({ name: 'search', required: false, type: SearchNoteDto })
    @ApiResponse({ status: 200, description: 'Return all notes.' })
    async findAll(@Query() search?: SearchNoteDto) {
        return this.client.send({ cmd: NotesCommands.FIND_ALL }, search);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Retrieve a note by ID' })
    @ApiParam({ name: 'id', required: true, description: 'ID of the note to retrieve' })
    @ApiResponse({ status: 200, description: 'Return the note.' })
    @ApiResponse({ status: 404, description: 'Note not found.' })
    async findOne(@Param('id') id: string) {
        return this.client.send({ cmd: NotesCommands.FIND_ONE }, id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a note by ID' })
    @ApiParam({ name: 'id', required: true, description: 'ID of the note to update' })
    @ApiBody({ type: UpdateNoteDto })
    @ApiResponse({ status: 200, description: 'The note has been successfully updated.' })
    @ApiResponse({ status: 404, description: 'Note not found.' })
    async update(@Param('id') id: string, @Body() updateNoteDto: UpdateNoteDto) {
        return this.client.send({ cmd: NotesCommands.UPDATE }, { id, data: updateNoteDto });
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a note by ID' })
    @ApiParam({ name: 'id', required: true, description: 'ID of the note to delete' })
    @ApiResponse({ status: 200, description: 'The note has been successfully deleted.' })
    @ApiResponse({ status: 404, description: 'Note not found.' })
    async remove(@Param('id') id: string) {
        return this.client.send({ cmd: NotesCommands.DELETE }, id);
    }
}