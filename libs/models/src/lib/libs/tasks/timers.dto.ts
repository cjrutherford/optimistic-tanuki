import { ApiProperty, PartialType } from "@nestjs/swagger";

export declare type TimerStatusString = 'active' | 'paused' | 'completed' | 'deleted';  

export class CreateTimerDto {
    @ApiProperty()
    start: Date;

    @ApiProperty()
    end: Date;

    @ApiProperty()
    duration: number;

    @ApiProperty()
    description: string;

    @ApiProperty()
    taskId: string;
}

export class UpdateTimerDto extends PartialType(CreateTimerDto) {}
