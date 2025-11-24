import { Body, Controller, Delete, Get, HttpException, Inject, Logger, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ContactCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { ContactQueryDto, CreateContactDto, UpdateContactDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { AuthGuard } from '../../auth/auth.guard';

@Controller('contact')
@UseGuards(AuthGuard, PermissionsGuard)
export class ContactController {
    constructor(@Inject(ServiceTokens.BLOG_SERVICE) private readonly contactService: ClientProxy, private readonly l: Logger) {
        this.l.log('ContactController initialized');
        console.log('ContactController connecting to contactService...');
        this.contactService.connect().then(() => {
            this.l.log('ContactController connected to contactService');
        }).catch(e => this.l.error('Error connecting to contactService', e));
    }

    @Post()
    @RequirePermissions('blog.post.create')
    async createContact(@Body() createContact: CreateContactDto) {
        try {
            await firstValueFrom(this.contactService.send({ cmd: ContactCommands.CREATE }, createContact));
            this.l.log('Contact created successfully');
            return { message: 'Contact created successfully' };
        } catch (error) {
            this.l.error('Error creating contact', error);
            throw new HttpException('Failed to create contact: [' + error.message + ']', 500);
        }
    }

    @Post("/find")
    @RequirePermissions('blog.post.read')
    async findAllContacts(@Body() query: ContactQueryDto) {
        try {
            const contacts = await firstValueFrom(this.contactService.send({ cmd: ContactCommands.FIND_ALL }, query));
            this.l.log('Contacts retrieved successfully');
            return contacts;
        } catch (error) {
            this.l.error('Error retrieving contacts', error);
            throw new HttpException('Failed to retrieve contacts: [' + error.message + ']', 500);
        }
    }

    @Get('/:id')
    @RequirePermissions('blog.post.read')
    async getContact(@Param('id') id: string) {
        try {
            const contact = await firstValueFrom(this.contactService.send({ cmd: ContactCommands.FIND }, id));
            if (!contact) {
                this.l.error(`Contact ${id} not found`);
                throw new HttpException('Contact not found', 404);
            }
            this.l.log(`Contact ${id} retrieved successfully`);
            return contact;
        } catch (error) {
            this.l.error(`Error retrieving contact ${id}`, error);  
            if (error.status === 404) {
                throw error;
            }
            throw new HttpException('Failed to retrieve contact: [' + error.message + ']', 500);
        }
    }

    @Patch('/:id')
    @RequirePermissions('blog.post.update')
    async updateContact(@Param('id') id: string, @Body() updateData: UpdateContactDto) {
        try {
            const updatedContact = await firstValueFrom(this.contactService.send({ cmd: ContactCommands.UPDATE }, { id, updateContactDto: updateData }));
            if (!updatedContact) {
                throw new HttpException('Contact not found', 404);
            }
            this.l.log(`Contact ${id} updated successfully`);
            return updatedContact;
        } catch (error) {
            this.l.error(`Error updating contact ${id}`, error);
            if (error.status === 404) {
                throw error;
            }
            throw new HttpException('Failed to update contact: [' + error.message + ']', 500);
        }
    }

    @Delete('/:id')
    @RequirePermissions('blog.post.delete')
    async deleteContact(@Param('id') id: string) {
        try {
            await firstValueFrom(this.contactService.send({ cmd: ContactCommands.DELETE }, id));
            this.l.log(`Contact ${id} deleted successfully`);
            return { message: 'Contact deleted successfully' };
        } catch (error) {
            this.l.error(`Error deleting contact ${id}`, error);
            throw new HttpException('Failed to delete contact: [' + error.message + ']', 500);
        }
    }
}
