import { CreateLeadDto } from './create-lead.dto';
import { LeadAuthContext } from './lead-auth-context.interface';

/** Internal Gateway-to-Lead-Tracker envelope; recipients come from server routing config. */
export interface CreateLeadRequest {
  dto: CreateLeadDto;
  context: LeadAuthContext;
  ownerNotificationRecipients?: string[];
}
