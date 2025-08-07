import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Main application controller for the Gateway microservice.
 */
@Controller()
export class AppController {
  /**
   * Creates an instance of AppController.
   * @param appService The application service.
   */
  constructor(private readonly appService: AppService) {}

  /**
   * Retrieves data from the application service.
   * @returns Data from the application service.
   */
  @Get()
  getData() {
    return this.appService.getData();
  }
}
