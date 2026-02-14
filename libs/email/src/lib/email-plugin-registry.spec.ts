import { EmailPluginRegistry } from './email-plugin-registry';
import { EmailProvider, EmailMessage, EmailSendResult } from './interfaces';

class MockProvider implements EmailProvider {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    return { success: true, messageId: `${this.name}-123` };
  }
  async verifyConnection(): Promise<boolean> {
    return true;
  }
}

describe('EmailPluginRegistry', () => {
  let registry: EmailPluginRegistry;

  beforeEach(() => {
    registry = new EmailPluginRegistry();
  });

  it('should start with no providers', () => {
    expect(registry.getRegisteredProviders()).toEqual([]);
    expect(registry.getActiveProvider()).toBeNull();
  });

  it('should register a provider', () => {
    const provider = new MockProvider('smtp');
    registry.register(provider);
    expect(registry.getRegisteredProviders()).toEqual(['smtp']);
  });

  it('should set first registered provider as active', () => {
    const provider = new MockProvider('smtp');
    registry.register(provider);
    expect(registry.getActiveProvider()).toBe(provider);
  });

  it('should keep first provider active when registering additional providers', () => {
    const smtp = new MockProvider('smtp');
    const api = new MockProvider('sendgrid');
    registry.register(smtp);
    registry.register(api);
    expect(registry.getActiveProvider()).toBe(smtp);
    expect(registry.getRegisteredProviders()).toEqual(['smtp', 'sendgrid']);
  });

  it('should allow changing active provider', () => {
    const smtp = new MockProvider('smtp');
    const api = new MockProvider('sendgrid');
    registry.register(smtp);
    registry.register(api);
    registry.setActiveProvider('sendgrid');
    expect(registry.getActiveProvider()).toBe(api);
  });

  it('should throw when setting active to unregistered provider', () => {
    expect(() => registry.setActiveProvider('nonexistent')).toThrow(
      'Email provider "nonexistent" is not registered'
    );
  });

  it('should get provider by name', () => {
    const provider = new MockProvider('smtp');
    registry.register(provider);
    expect(registry.getProvider('smtp')).toBe(provider);
    expect(registry.getProvider('nonexistent')).toBeNull();
  });
});
