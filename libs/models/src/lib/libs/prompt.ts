export class PromptSendDto {
    system: string;
    prompt: string;
    userId: string;
}

export class GeneratePrompt {
    model: string;
    messages: { role: string; content: string }[];
    suffix?: string;
    format?: 'json';
    options?: Record<string, any>;
    system?: string;
    context?: string;
    stream?: boolean;
}