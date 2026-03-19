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

  private resolveMonthYear(month?: string, year?: string) {
    const now = new Date();
    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    const targetMonth =
      Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : now.getMonth() + 1;
    const targetYear =
      Number.isInteger(parsedYear) && parsedYear >= 1970 && parsedYear <= 3000
        ? parsedYear
        : now.getFullYear();

    return { targetMonth, targetYear };
  }

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
    @Query('month') month?: string,
    @Query('year') year?: string
  ) {
    const { targetMonth, targetYear } = this.resolveMonthYear(month, year);
    return firstValueFrom(
      this.paymentsClient.send(
        { cmd: 'payments.getDonationGoal' },
        { month: targetMonth, year: targetYear }
      )
    );
  }

  @Get('')
  @Public()
  async getDonations(
    @Query('month') month?: string,
    @Query('year') year?: string
  ) {
    const { targetMonth, targetYear } = this.resolveMonthYear(month, year);
    return firstValueFrom(
      this.paymentsClient.send(
        { cmd: 'payments.listDonations' },
        { month: targetMonth, year: targetYear }
      )
    );
  }
}
