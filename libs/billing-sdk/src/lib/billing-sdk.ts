import {
  BatchRecordUsageDto,
  PeriodInvoicePreviewInput,
  RecordUsageDto,
} from '@optimistic-tanuki/billing-contracts';

export function buildRecordUsagePayload(
  input: RecordUsageDto,
): RecordUsageDto {
  return {
    ...input,
  };
}

export function buildBatchRecordUsagePayload(
  events: RecordUsageDto[],
): BatchRecordUsageDto {
  return {
    events: events.map((event) => buildRecordUsagePayload(event)),
  };
}

export function buildPeriodInvoicePreviewPayload(
  input: PeriodInvoicePreviewInput,
): PeriodInvoicePreviewInput {
  return {
    ...input,
    meter: {
      ...input.meter,
    },
  };
}
