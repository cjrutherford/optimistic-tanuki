import { Body, Controller, Delete, Get, HttpException, Inject, Logger, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { EventCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { EventQueryDto, CreateEventDto, UpdateEventDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { AuthGuard } from '../../auth/auth.guard';

@Controller('event')
@UseGuards(AuthGuard, PermissionsGuard)
export class EventController {
    constructor(@Inject(ServiceTokens.BLOG_SERVICE) private readonly eventService: ClientProxy, private readonly l: Logger) {
        this.l.log('EventController initialized');
        console.log('EventController connecting to eventService...');
        this.eventService.connect().then(() => {
            this.l.log('EventController connected to eventService');
        }).catch(e => this.l.error('Error connecting to eventService', e));
    }

    @Post()
    @RequirePermissions('blog.post.create')
    async createEvent(@Body() createEvent: CreateEventDto) {
        try {
            const event = await firstValueFrom(this.eventService.send({ cmd: EventCommands.CREATE }, createEvent));
            this.l.log('Event created successfully');
            return event;
        } catch (error) {
            this.l.error('Error creating event', error);
            throw new HttpException('Failed to create event: [' + error.message + ']', 500);
        }
    }

    @Post("/find")
    @RequirePermissions('blog.post.read')
    async findAllEvents(@Body() query: EventQueryDto) {
        try {
            const events = await firstValueFrom(this.eventService.send({ cmd: EventCommands.FIND_ALL }, query));
            this.l.log('Events retrieved successfully');
            return events;
        } catch (error) {
            this.l.error('Error retrieving events', error);
            throw new HttpException('Failed to retrieve events: [' + error.message + ']', 500);
        }
    }

    @Get('/:id')
    @RequirePermissions('blog.post.read')
    async getEvent(@Param('id') id: string) {
        try {
            const event = await firstValueFrom(this.eventService.send({ cmd: EventCommands.FIND }, id));
            if (!event) {
                this.l.error(`Event ${id} not found`);
                throw new HttpException('Event not found', 404);
            }
            this.l.log(`Event ${id} retrieved successfully`);
            return event;
        } catch (error) {
            this.l.error(`Error retrieving event ${id}`, error);  
            if (error.status === 404) {
                throw error;
            }
            throw new HttpException('Failed to retrieve event: [' + error.message + ']', 500);
        }
    }

    @Patch('/:id')
    @RequirePermissions('blog.post.update')
    async updateEvent(@Param('id') id: string, @Body() updateData: UpdateEventDto) {
        try {
            const updatedEvent = await firstValueFrom(this.eventService.send({ cmd: EventCommands.UPDATE }, { id, updateEventDto: updateData }));
            if (!updatedEvent) {
                throw new HttpException('Event not found', 404);
            }
            this.l.log(`Event ${id} updated successfully`);
            return updatedEvent;
        } catch (error) {
            this.l.error(`Error updating event ${id}`, error);
            if (error.status === 404) {
                throw error;
            }
            throw new HttpException('Failed to update event: [' + error.message + ']', 500);
        }
    }

    @Delete('/:id')
    @RequirePermissions('blog.post.delete')
    async deleteEvent(@Param('id') id: string) {
        try {
            await firstValueFrom(this.eventService.send({ cmd: EventCommands.DELETE }, id));
            this.l.log(`Event ${id} deleted successfully`);
            return { message: 'Event deleted successfully' };
        } catch (error) {
            this.l.error(`Error deleting event ${id}`, error);
            throw new HttpException('Failed to delete event: [' + error.message + ']', 500);
        }
    }
}
