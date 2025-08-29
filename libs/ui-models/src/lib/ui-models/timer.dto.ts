export enum TimerStatus {
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    DELETED = 'deleted'
}

export class TimerDto {
    id!: string;
    taskId!: string;
    start!: Date;
    end!: Date;
    duration!: number;
    description!: string;
    createdAt!: Date;
    updatedAt!: Date;
    deletedAt!: Date;
    status!: TimerStatus;
}

export type CreateTimerDto = Omit<TimerDto, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;