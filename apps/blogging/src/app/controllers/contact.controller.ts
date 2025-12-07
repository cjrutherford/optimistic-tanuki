import { Controller, Logger } from "@nestjs/common";
import { MessagePattern, Payload, RpcException } from "@nestjs/microservices";
import { ContactCommands } from "@optimistic-tanuki/constants";
import { CreateContactDto, ContactDto, ContactQueryDto, UpdateContactDto } from "@optimistic-tanuki/models";
import { ContactService } from "../services";

@Controller('contact')
export class ContactController {
    constructor(
        private readonly l: Logger,
        private readonly contactService: ContactService
    ) {
        this.l.log('ContactController initialized');
    }

    @MessagePattern({ cmd: ContactCommands.CREATE })
    async createContact(@Payload() createContactDto: CreateContactDto): Promise<ContactDto> {
        this.l.log('Starting createContact');
        try {
            const result = await this.contactService.create(createContactDto);
            this.l.log('Finished createContact');
            return result;
        } catch (error) {
            console.dir(error);
            this.l.error('Error in createContact', error);
            throw new RpcException(error);
        }
    }

    @MessagePattern({ cmd: ContactCommands.FIND_ALL })
    async findAllContacts(@Payload() query: ContactQueryDto): Promise<ContactDto[]> {
        this.l.log('Starting findAllContacts');
        try {
            const result = await this.contactService.findAll(query);
            this.l.log('Finished findAllContacts');
            return result;
        } catch (error) {
            this.l.error('Error in findAllContacts', error);
            throw new RpcException(error);
        }
    }

    @MessagePattern({ cmd: ContactCommands.FIND })
    async findOneContact(@Payload() id: string): Promise<ContactDto> {
        this.l.log('Starting findOneContact');
        try {
            const result = await this.contactService.findOne(id);
            this.l.log('Finished findOneContact');
            return result;
        } catch (error) {
            this.l.error('Error in findOneContact', error);
            throw new RpcException(error);
        }
    }

    @MessagePattern({ cmd: ContactCommands.UPDATE })
    async updateContact(@Payload() data: { id: string, updateContactDto: UpdateContactDto }): Promise<ContactDto> {
        this.l.log('Starting updateContact');
        try {
            const result = await this.contactService.update(data.id, data.updateContactDto);
            this.l.log('Finished updateContact');
            return result;
        } catch (error) {
            this.l.error('Error in updateContact', error);
            throw new RpcException(error);
        }
    }

    @MessagePattern({ cmd: ContactCommands.DELETE })
    async deleteContact(@Payload() id: string): Promise<void> {
        this.l.log('Starting deleteContact');
        try {
            await this.contactService.remove(id);
            this.l.log('Finished deleteContact');
        } catch (error) {
            this.l.error('Error in deleteContact', error);
            throw new RpcException(error);
        }
    }
}