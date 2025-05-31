import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NoteEntity } from "../entities";
import { Repository } from "typeorm";
import { CreateNoteDto, SearchNoteDto, UpdateNoteDto } from "@optimistic-tanuki/models";
import { convertSearchNoteDtoToFindOptions } from "../entities/note.entity";

@Injectable()
export class NotesService {
    constructor(@Inject(getRepositoryToken(NoteEntity))private readonly noteRepo: Repository<NoteEntity>) {}

    async create(createNoteDto: CreateNoteDto): Promise<NoteEntity> {
        const note = await this.noteRepo.create(createNoteDto);
        return (await this.noteRepo.save(note))[0];
    }

    async findAll(search?: SearchNoteDto): Promise<NoteEntity[]> {
        const query = convertSearchNoteDtoToFindOptions(search);
        return await this.noteRepo.find(query);
    }

    async findOne(id: string): Promise<NoteEntity> {
        return await this.noteRepo.findOne({ where: { id }});
    }

    async update(id: string, updateNoteDto: UpdateNoteDto): Promise<NoteEntity> {
        await this.noteRepo.update(id, updateNoteDto);
        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        await this.noteRepo.delete(id);
    }
}