import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ContactCommands } from "@optimistic-tanuki/constants";
import { CreateContactDto, ContactDto, ContactQueryDto, UpdateContactDto } from "@optimistic-tanuki/models";
import { ContactService } from "../services";

@Controller('contact')
export class ContactController {
    constructor(private readonly contactService: ContactService) {
        console.log('ContactController initialized');
    }

    @MessagePattern({ cmd: ContactCommands.CREATE })
    async createContact(@Payload() createContactDto: CreateContactDto): Promise<ContactDto> {
        return await this.contactService.create(createContactDto);
    }

    @MessagePattern({ cmd: ContactCommands.FIND_ALL })
    async findAllContacts(@Payload() query: ContactQueryDto): Promise<ContactDto[]> {
        return await this.contactService.findAll(query);
    }

    @MessagePattern({ cmd: ContactCommands.FIND })
    async findOneContact(@Payload() id: string): Promise<ContactDto> {
        return await this.contactService.findOne(id);
    }

    @MessagePattern({ cmd: ContactCommands.UPDATE })
    async updateContact(@Payload() data: { id: string, updateContactDto: UpdateContactDto }): Promise<ContactDto> {
        return await this.contactService.update(data.id, data.updateContactDto);
    }

    @MessagePattern({ cmd: ContactCommands.DELETE })
    async deleteContact(@Payload() id: string): Promise<void> {
        return await this.contactService.remove(id);
    }
}