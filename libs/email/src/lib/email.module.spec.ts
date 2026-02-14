import { Test, TestingModule } from '@nestjs/testing';
import { EmailModule } from './email.module';
import { EmailService } from './email.service';
import { EmailPluginRegistry } from './email-plugin-registry';
import { ConsoleEmailProvider } from './providers';

describe('EmailModule', () => {
  it('should provide EmailService and EmailPluginRegistry with forRoot', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        EmailModule.forRoot({
          providers: [new ConsoleEmailProvider()],
        }),
      ],
    }).compile();

    const emailService = module.get<EmailService>(EmailService);
    const registry = module.get<EmailPluginRegistry>(EmailPluginRegistry);

    expect(emailService).toBeDefined();
    expect(registry).toBeDefined();
    expect(registry.getRegisteredProviders()).toContain('console');
  });

  it('should work with no options', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EmailModule.forRoot()],
    }).compile();

    const emailService = module.get<EmailService>(EmailService);
    expect(emailService).toBeDefined();
  });

  it('should set active provider when specified', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        EmailModule.forRoot({
          providers: [new ConsoleEmailProvider()],
          activeProvider: 'console',
        }),
      ],
    }).compile();

    const registry = module.get<EmailPluginRegistry>(EmailPluginRegistry);
    const active = registry.getActiveProvider();
    expect(active).toBeDefined();
    expect(active?.name).toBe('console');
  });

  it('should send email through configured provider', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        EmailModule.forRoot({
          providers: [new ConsoleEmailProvider()],
        }),
      ],
    }).compile();

    const emailService = module.get<EmailService>(EmailService);
    const result = await emailService.sendEmail({
      to: 'test@example.com',
      subject: 'Integration Test',
      text: 'This is a test email',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('console-');
  });

  it('should work with forRootAsync', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        EmailModule.forRootAsync({
          useFactory: () => ({
            providers: [new ConsoleEmailProvider()],
          }),
        }),
      ],
    }).compile();

    const emailService = module.get<EmailService>(EmailService);
    expect(emailService).toBeDefined();

    const result = await emailService.sendEmail({
      to: 'async@example.com',
      subject: 'Async Test',
      text: 'Test',
    });
    expect(result.success).toBe(true);
  });
});
