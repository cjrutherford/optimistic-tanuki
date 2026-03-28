import { Controller, Get, Param, Query, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ServiceTokens, HardwareCommands } from '@optimistic-tanuki/constants';
import { ChassisType, ChassisUseCase } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { Public } from '../../decorators/public.decorator';

@ApiTags('hardware-chassis')
@Controller('hardware/chassis')
export class HardwareChassisController {
  constructor(
    @Inject(ServiceTokens.HARDWARE_SERVICE)
    private readonly hardwareClient: ClientProxy
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all chassis options' })
  @ApiQuery({ name: 'type', enum: ChassisType, required: false })
  @ApiQuery({ name: 'useCase', enum: ChassisUseCase, required: false })
  async findAll(
    @Query('type') type?: ChassisType,
    @Query('useCase') useCase?: ChassisUseCase
  ) {
    return firstValueFrom(
      this.hardwareClient.send(
        { cmd: HardwareCommands.FIND_ALL_CHASSIS },
        { type, useCase }
      )
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get chassis by ID' })
  async findById(@Param('id') id: string) {
    return firstValueFrom(
      this.hardwareClient.send(
        { cmd: HardwareCommands.FIND_CHASSIS_BY_ID },
        { id }
      )
    );
  }

  @Get(':id/compatible')
  @Public()
  @ApiOperation({ summary: 'Get compatible components' })
  async getCompatible(@Param('id') id: string) {
    return firstValueFrom(
      this.hardwareClient.send(
        { cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS },
        { chassisId: id }
      )
    );
  }
}
