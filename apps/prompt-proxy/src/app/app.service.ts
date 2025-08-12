import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { GeneratePrompt } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  constructor(
    private httpService: HttpService,
    @Inject('API_BASE_URL') private apiUrl: string
  ) {}

  async sendMessage(data: GeneratePrompt) {
    const response = await firstValueFrom(this.httpService.post(`${this.apiUrl}/api/chat`, data));
    return response.data;
  }
}
