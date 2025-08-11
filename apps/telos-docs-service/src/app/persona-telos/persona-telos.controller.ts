import { Controller } from '@nestjs/common';
import { PersonaTelosService } from './persona-telos.service';
import { MessagePattern } from '@nestjs/microservices';
import { PersonaTelosCommands } from '@optimistic-tanuki/constants'
import { CreatePersonaTelosDto, QueryPersonaTelsosDto, UpdatePersonaTelosDto } from '@optimistic-tanuki/models';

@Controller('persona-telos')
export class PersonaTelosController {
    constructor(
        private readonly personaTelosService: PersonaTelosService
    ) {}

    @MessagePattern({ cmd: PersonaTelosCommands.CREATE })
    create(data: CreatePersonaTelosDto) {
        return this.personaTelosService.create(data);
    }

    @MessagePattern({ cmd: PersonaTelosCommands.UPDATE })
    update(data: UpdatePersonaTelosDto) {
        return this.personaTelosService.update(data.id, data);
    }

    @MessagePattern({ cmd: PersonaTelosCommands.DELETE })
    delete(id: string) {
        return this.personaTelosService.remove(id);
    }

    @MessagePattern({ cmd: PersonaTelosCommands.FIND })
    find(data: QueryPersonaTelsosDto ) {
        return this.personaTelosService.findAll(data);
    }

    @MessagePattern({ cmd: PersonaTelosCommands.FIND_ONE })
    findOne(data: string) {
        return this.personaTelosService.findOne(data);
    }
}
