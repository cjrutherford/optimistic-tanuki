# leads-feature-flags Flagging Flow

```mermaid
flowchart TD
  Reviewer[Reviewer]
  Service[LeadFlagsService]
  GetFlags[getLeadFlags]
  FlagLead[flagLead]
  Api[/api/leads/:leadId/flags]

  Reviewer --> Service
  Service --> GetFlags
  Service --> FlagLead
  GetFlags --> Api
  FlagLead --> Api
```
