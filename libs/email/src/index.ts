export { EmailModule, EmailModuleOptions } from './lib/email.module';
export { EmailService } from './lib/email.service';
export { EmailPluginRegistry } from './lib/email-plugin-registry';
export {
  renderDomainEmailTemplate,
  rootDomainFor,
  DomainEmailAction,
  DomainEmailTemplateOptions,
  EmailTemplateTone,
  RenderedDomainEmail,
} from './lib/templates/domain-email-template';
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
