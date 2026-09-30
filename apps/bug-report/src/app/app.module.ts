import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  ConsoleEmailProvider,
  EmailModule,
  SmtpEmailProvider,
} from '@optimistic-tanuki/email';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NonceService } from './nonce/nonce.service';
import { BugReportController } from './reports/bug-report.controller';
import { BugReportService } from './reports/bug-report.service';
import { GithubService } from './reports/github.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 20,
      },
    ]),
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
  controllers: [AppController, BugReportController],
  providers: [
    AppService,
    NonceService,
    BugReportService,
    GithubService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
