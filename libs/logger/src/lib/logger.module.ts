import { Logger, Module } from '@nestjs/common';

/**
 * The LoggerModule provides a configurable logger for the application.
 */
@Module({
  controllers: [],
  providers: [{
    provide: Logger,
    useClass: Logger
  }],
  exports: [Logger],
})
export class LoggerModule {}
