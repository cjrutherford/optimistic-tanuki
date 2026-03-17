import {
  Controller,
  Get,
  Query,
  Param,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { TcpServiceConfig } from '../../config';
import { Public } from '../../decorators/public.decorator';

@Controller('donations')
export class DonationsController {
  private readonly paymentsClient: ReturnType<typeof ClientProxyFactory.create>;

  constructor(private readonly configService: ConfigService) {
    const serviceConfig =
      this.configService.get<TcpServiceConfig>('services.payments');
    this.paymentsClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: serviceConfig.host,
        port: serviceConfig.port,
      },
    });
  }

  @Get('goal')
  @Public()
  async getDonationGoal(
    @Query('month') month?: number,
    @Query('year') year?: number
  ) {
    return firstValueFrom(
      this.paymentsClient.send(
        { cmd: 'payments.getDonationGoal' },
        { month, year }
      )
    );
  }

  @Get('')
  @Public()
  async getDonations(
    @Query('month') month?: number,
    @Query('year') year?: number
  ) {
    return firstValueFrom(
      this.paymentsClient.send(
        { cmd: 'payments.listDonations' },
        { month, year }
      )
    );
  }
}
