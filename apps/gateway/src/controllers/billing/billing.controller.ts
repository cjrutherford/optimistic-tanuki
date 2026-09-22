import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import {
  BatchRecordUsageDto,
  BillingCommands,
  InvoicePreviewInput,
  PeriodInvoicePreviewInput,
  RecordUsageDto,
} from '@optimistic-tanuki/billing-contracts';
import { ServiceTokens } from '@optimistic-tanuki/constants';

// NOTE: AuthGuard only — no PermissionsGuard yet. `billing.*` permission
// strings don't exist in the permissions service, so requiring them would
// hard-deny every call. They get defined with the billing UI (O17); until
// then tenant isolation comes from the validated DTO scope fields.
@ApiTags('billing')
@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    @Inject(ServiceTokens.BILLING_SERVICE)
    private readonly billingClient: ClientProxy
  ) {}

  private mapBillingRpcError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : undefined;
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message?: unknown }).message
        : undefined;
    const normalizedMessage =
      typeof message === 'string'
        ? message
        : error instanceof Error
        ? error.message
        : 'Billing service request failed';

    switch (statusCode) {
      case 400:
        throw new BadRequestException(normalizedMessage);
      case 404:
        throw new NotFoundException(normalizedMessage);
      default:
        throw new InternalServerErrorException(normalizedMessage);
    }
  }

  private async sendBillingCommand<T>(
    pattern: { cmd: string },
    payload: unknown
  ): Promise<T> {
    return await firstValueFrom(
      this.billingClient
        .send<T>(pattern, payload)
        .pipe(
          catchError((error) =>
            throwError(() => this.mapBillingRpcError(error))
          )
        )
    );
  }
  @Post('usage/record')
  @ApiOperation({ summary: 'Record a single usage event' })
  @ApiResponse({ status: 201, description: 'The usage event was recorded.' })
  async recordUsage(@Body() dto: RecordUsageDto) {
    this.logger.log(`Recording usage for meter: '${dto.meterId}'`);
    return this.sendBillingCommand({ cmd: BillingCommands.RECORD_USAGE }, dto);
  }

  @Post('usage/batch')
  @ApiOperation({ summary: 'Record a batch of usage events' })
  @ApiResponse({ status: 201, description: 'The usage events were recorded.' })
  async batchRecordUsage(@Body() dto: BatchRecordUsageDto) {
    this.logger.log(`Recording batch of ${dto.events.length} usage events`);
    return this.sendBillingCommand(
      { cmd: BillingCommands.BATCH_RECORD_USAGE },
      dto
    );
  }

  @Post('invoices/preview')
  @ApiOperation({ summary: 'Preview an invoice for a period or ad-hoc input' })
  @ApiResponse({ status: 201, description: 'The invoice preview.' })
  @ApiExtraModels(InvoicePreviewInput, PeriodInvoicePreviewInput)
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(InvoicePreviewInput) },
        { $ref: getSchemaPath(PeriodInvoicePreviewInput) },
      ],
    },
  })
  async previewInvoice(
    @Body() dto: InvoicePreviewInput | PeriodInvoicePreviewInput
  ) {
    // Union bodies have design-time metatype Object, so the global
    // ValidationPipe cannot validate them — malformed payloads used to sail
    // through to TCP (where every error collapses to a 500) instead of
    // failing with 400 like the single-DTO routes. Validate explicitly with
    // the same pipe settings (whitelist + forbidNonWhitelisted + transform).
    // The @ApiBody oneOf above keeps the OpenAPI body declaration intact.
    const payload = await toValidatedPreview(dto);
    // Same dispatch rule as the microservice (`'periodStart' in payload`):
    // a period-bound preview becomes a period quote, otherwise an ad-hoc one.
    return this.sendBillingCommand(
      { cmd: BillingCommands.PREVIEW_INVOICE },
      payload
    );
  }
}

async function toValidatedPreview(
  dto: InvoicePreviewInput | PeriodInvoicePreviewInput
): Promise<InvoicePreviewInput | PeriodInvoicePreviewInput> {
  const candidate =
    dto && typeof dto === 'object' && 'periodStart' in dto
      ? plainToInstance(PeriodInvoicePreviewInput, dto)
      : plainToInstance(InvoicePreviewInput, dto);
  const errors = await validate(candidate, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
  return candidate;
}
