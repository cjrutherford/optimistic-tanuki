import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { EventCommands } from "@optimistic-tanuki/constants";
import { CreateEventDto, EventDto, EventQueryDto, UpdateEventDto } from "@optimistic-tanuki/models";
import { EventService } from "../services";

@Controller('event')
export class EventController {
    constructor(private readonly eventService: EventService) {
        console.log('EventController initialized');
    }

    @MessagePattern({ cmd: EventCommands.CREATE })
    async createEvent(@Payload() createEventDto: CreateEventDto): Promise<EventDto> {
        return await this.eventService.create(createEventDto);
    }

    @MessagePattern({ cmd: EventCommands.FIND_ALL })
    async findAllEvents(@Payload() query: EventQueryDto): Promise<EventDto[]> {
        return await this.eventService.findAll(query);
    }

    @MessagePattern({ cmd: EventCommands.FIND })
    async findOneEvent(@Payload() id: string): Promise<EventDto> {
        return await this.eventService.findOne(id);
    }

    @MessagePattern({ cmd: EventCommands.UPDATE })
    async updateEvent(@Payload() data: { id: string, updateEventDto: UpdateEventDto }): Promise<EventDto> {
        return await this.eventService.update(data.id, data.updateEventDto);
    }

    @MessagePattern({ cmd: EventCommands.DELETE })
    async deleteEvent(@Payload() id: string): Promise<void> {
        return await this.eventService.remove(id);
    }
}