import {
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  PersonaTelosCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  PersonaTelosDto,
  QueryPersonaTelsosDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { firstValueFrom } from 'rxjs';

@ApiTags('persona')
@Controller('persona')
@UseGuards(AuthGuard)
export class PersonaController {
  constructor(
    private readonly logger: Logger,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsClient: ClientProxy
  ) {}

  @ApiOperation({ summary: 'Get all personas' })
  @ApiResponse({
    status: 200,
    description: 'The personas have been successfully retrieved.',
  })
  @Get()
  async getAllPersonas(
    @Query() query: QueryPersonaTelsosDto
  ): Promise<PersonaTelosDto[]> {
    this.logger.log('Fetching all personas with query:', query);
    return await firstValueFrom(
      this.telosDocsClient.send({ cmd: PersonaTelosCommands.FIND }, query || {})
    );
  }

  @ApiOperation({ summary: 'Get a persona by ID' })
  @ApiResponse({
    status: 200,
    description: 'The persona has been successfully retrieved.',
  })
  @ApiResponse({ status: 404, description: 'Persona not found.' })
  @Get(':id')
  async getPersona(@Param('id') id: string): Promise<PersonaTelosDto> {
    this.logger.log(`Fetching persona with ID: ${id}`);
    return await firstValueFrom(
      this.telosDocsClient.send({ cmd: PersonaTelosCommands.FIND_ONE }, { id })
    );
  }
}
