import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { GeneratePrompt } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

const DEFAULT_PROMPT_PROXY_TIMEOUT_MS = 120000;

function getPromptProxyTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.PROMPT_PROXY_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PROMPT_PROXY_TIMEOUT_MS;
}

@Injectable()
export class AppService {
  constructor(
    private httpService: HttpService,
    @Inject('API_BASE_URL') private apiUrl: string,
    private readonly l: Logger
  ) {}

  async sendMessage(data: GeneratePrompt) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/api/chat`, data, {
          timeout: getPromptProxyTimeoutMs(),
        })
      );
      this.l.verbose(response.data);
      if (response.data.message) {
        this.l.log(
          `LLM Response: ${JSON.stringify(response.data.message, null, 2)}`
        );
      }
      const usage = response.data ?? {};
      const durationMs = usage.total_duration
        ? Math.round(usage.total_duration / 1e6)
        : 0;
      this.l.log(
        `LLM usage model=${usage.model ?? 'unknown'} promptTokens=${
          usage.prompt_eval_count ?? 0
        } completionTokens=${usage.eval_count ?? 0} durationMs=${durationMs}`
      );
      return response.data;
    } catch (error) {
      this.l.error('Error in sendMessage:', error?.stack ?? error);
      throw new RpcException(error.message);
    }
  }
}
