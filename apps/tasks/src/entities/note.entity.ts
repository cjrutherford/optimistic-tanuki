import { Column, Entity, LessThan, LessThanOrEqual, Like, ManyToOne, MoreThan, MoreThanOrEqual, Not, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { TaskEntity } from "./task.entity";
import { SearchNoteDto } from "@optimistic-tanuki/models";

export enum NoteStatus {
    Draft = 'draft',
    Published = 'published',
    Archived = 'archived',
    Deleted = 'deleted',
    Public = 'public',
}

@Entity()
export class NoteEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column({ nullable: true })
    projectId: string;

    @Column({ nullable: true })
    taskId: string;

    @Column()
    title: string;

    @Column()
    description: string;

    @Column({ type: 'text'})
    contents: string;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    @Column({ type: 'enum', enum: NoteStatus, default: NoteStatus.Draft })
    status: NoteStatus;

    @ManyToOne(type => TaskEntity, task => task.notes)
    task: TaskEntity;
}

export function convertSearchNoteDtoToFindOptions(searchNoteDto: SearchNoteDto): any {
    const findOptions: any = {
        where: {},
    };

    if (searchNoteDto.userId) {
        findOptions.where.userId = searchNoteDto.userId;
    }

    if (searchNoteDto.taskId) {
        findOptions.where.taskId = searchNoteDto.taskId;
    }

    if (searchNoteDto.title) {
        findOptions.where.title = searchNoteDto.title;
    }

    if (searchNoteDto.status) {
        findOptions.where.status = searchNoteDto.status;
    }

    if(searchNoteDto.contents) {
        findOptions.where.contents = Like(`%${searchNoteDto.contents}%`);
    }

    if(searchNoteDto.filterColumn && searchNoteDto.filterValue && searchNoteDto.filterOperator) {
        switch (searchNoteDto.filterOperator) {
            case '=':
                findOptions.where[searchNoteDto.filterColumn] = searchNoteDto.filterValue;
                break;
            case '!=':
                findOptions.where[searchNoteDto.filterColumn] = Not(searchNoteDto.filterValue);
                break;
            case '<':
                findOptions.where[searchNoteDto.filterColumn] = LessThan(searchNoteDto.filterValue);
                break;
            case '>':
                findOptions.where[searchNoteDto.filterColumn] = MoreThan(searchNoteDto.filterValue);
                break;
            case '<=':
                findOptions.where[searchNoteDto.filterColumn] = LessThanOrEqual(searchNoteDto.filterValue);
                break;
            case '>=':
                findOptions.where[searchNoteDto.filterColumn] = MoreThanOrEqual(searchNoteDto.filterValue);
                break;
            case 'LIKE':
                findOptions.where[searchNoteDto.filterColumn] = Like(`%${searchNoteDto.filterValue}%`);
                break;
        }
    }

    return findOptions;
}