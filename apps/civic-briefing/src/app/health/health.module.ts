import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  ConsoleEmailProvider,
  EmailModule,
  EmailService,
  SmtpEmailProvider,
} from '@optimistic-tanuki/email';
import type { DataSource } from 'typeorm';
import { HealthController } from './health.controller';
import { PipelineHealthService } from './pipeline-health.service';

@Module({
  imports: [
    // Alert email, the platform's way: SMTP when configured, else the log.
    EmailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const smtpHost = config.get<string>('SMTP_HOST');
        if (!smtpHost) return { providers: [new ConsoleEmailProvider()] };
        return {
          providers: [
            new SmtpEmailProvider({
              host: smtpHost,
              port: Number(config.get<string | number>('SMTP_PORT') || 465),
              secure: String(config.get('SMTP_SECURE') ?? 'true') === 'true',
              auth: {
                user: config.get<string>('SMTP_USER') || '',
                pass: config.get<string>('SMTP_PASS') || '',
              },
              defaultFrom:
                config.get<string>('SMTP_FROM') ||
                'noreply@optimistic-tanuki.dev',
            }),
          ],
        };
      },
    }),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: PipelineHealthService,
      useFactory: (dataSource: DataSource, email: EmailService) =>
        new PipelineHealthService(dataSource, email),
      inject: [getDataSourceToken(), EmailService],
    },
  ],
  exports: [PipelineHealthService],
})
export class HealthModule {}
