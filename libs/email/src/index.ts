export { EmailModule, EmailModuleOptions } from './lib/email.module';
export { EmailService } from './lib/email.service';
export { EmailPluginRegistry } from './lib/email-plugin-registry';
export {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailAttachment,
  EmailTemplateData,
} from './lib/interfaces';
export {
  SmtpEmailProvider,
  SmtpConfig,
  HttpApiEmailProvider,
  HttpApiEmailConfig,
  ConsoleEmailProvider,
} from './lib/providers';
