
import { Controller, Post, Get, Put, Delete, Body, Param, Query } from "@nestjs/common";
import { NotesService } from "../services/notes.service";
import { CreateNoteDto, SearchNoteDto, UpdateNoteDto } from "@optimistic-tanuki/models";
import { NoteEntity } from "../entities";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { NotesCommands } from "@optimistic-tanuki/constants";

@Controller('notes')
export class NotesController {
    constructor(private readonly notesService: NotesService) {}

    @MessagePattern({ cmd: NotesCommands.CREATE })
    async create(@Payload() createNoteDto: CreateNoteDto): Promise<NoteEntity> {
        return this.notesService.create(createNoteDto);
    }

    @MessagePattern({ cmd: NotesCommands.FIND_ALL })
    async findAll(@Payload() search?: SearchNoteDto): Promise<NoteEntity[]> {
        return this.notesService.findAll(search);
    }

    @MessagePattern({ cmd: NotesCommands.FIND_ONE })
    async findOne(@Payload('id') id: string): Promise<NoteEntity> {
        return this.notesService.findOne(id);
    }

    @MessagePattern({ cmd: NotesCommands.UPDATE })
    async update(@Payload('id') id: string, @Payload('data') updateNoteDto: UpdateNoteDto): Promise<NoteEntity> {
        return this.notesService.update(id, updateNoteDto);
    }

    @MessagePattern({ cmd: NotesCommands.DELETE })
    async remove(@Payload('id') id: string): Promise<void> {
        return this.notesService.remove(id);
    }
}