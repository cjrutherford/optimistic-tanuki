import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { GeneratePrompt } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  constructor(
    private httpService: HttpService,
    @Inject('API_BASE_URL') private apiUrl: string,
    private readonly l: Logger
  ) {}

  async sendMessage(data: GeneratePrompt) {
    try {
      // Remove timeout or set to a very high value (e.g., 1 hour = 3600000 ms)
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/api/chat`, data, {
          timeout: 3600000,
        })
      );
      this.l.debug(response.data);
      if (response.data.message) {
        this.l.log(
          `LLM Response: ${JSON.stringify(response.data.message, null, 2)}`
        );
      }
      return response.data;
    } catch (error) {
      console.trace('Error in sendMessage:', error);
      throw new RpcException(error.message);
    }
  }
}
