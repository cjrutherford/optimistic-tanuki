import { Injectable } from '@nestjs/common';

@Injectable()
/**
 * Main application service for the Gateway microservice.
 */
@Injectable()
export class AppService {
  /**
   * Retrieves a simple greeting message.
   * @returns An object containing a greeting message.
   */
  getData(): { message: string } {
    return { message: 'Hello API' };
  }
}
