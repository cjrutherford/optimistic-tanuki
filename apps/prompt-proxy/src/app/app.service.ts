import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { GeneratePrompt } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  constructor(
    private httpService: HttpService,
    @Inject('API_BASE_URL') private apiUrl: string
  ) {}

  async sendMessage(data: GeneratePrompt) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/api/chat`, data, { timeout: 10000 })
      );
      return response.data;
    } catch (error) {
      console.trace('Error in sendMessage:', error);
      throw new RpcException(error.message);
    }
  }
}
