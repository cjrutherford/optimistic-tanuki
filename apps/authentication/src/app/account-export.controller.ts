import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { AccountExportService } from './account-export.service';
import { AccountExportJobService } from '../account-export-jobs/account-export-job.service';
import { AccountExportCaptureLeaseService } from '../account-export-jobs/account-export-capture-lease.service';
import { AccountExportDownloadService } from '../account-export-jobs/account-export-download.service';

@Controller()
export class AccountExportController {
  constructor(
    private readonly accountExport: AccountExportService,
    private readonly jobs: AccountExportJobService,
    private readonly captureLease: AccountExportCaptureLeaseService,
    private readonly downloads: AccountExportDownloadService
  ) {}

  @MessagePattern({ cmd: AuthCommands.OpenAccountExportDownload })
  openDownload(@Payload() request: unknown) {
    return this.downloads.open(request);
  }

  @MessagePattern({ cmd: AuthCommands.ReadAccountExportDownload })
  readDownload(@Payload() request: unknown) {
    return this.downloads.read(request);
  }

  @MessagePattern({ cmd: AuthCommands.CloseAccountExportDownload })
  async closeDownload(@Payload() request: unknown) {
    await this.downloads.close(request);
    return { closed: true };
  }

  @MessagePattern({ cmd: AuthCommands.ValidateAccountExportLease })
  validateCaptureLease(@Payload() request: unknown) {
    return this.captureLease.validate(request);
  }

  @MessagePattern({ cmd: AuthCommands.GetAccountExportSnapshot })
  getAuthenticationSnapshot(
    @Payload() data: { accountId?: unknown; token?: unknown; appId?: unknown }
  ) {
    return this.accountExport.getAuthenticationSnapshot(
      data?.accountId,
      data?.token,
      data?.appId
    );
  }

  @MessagePattern({ cmd: AuthCommands.CreateAccountExportJob })
  createExportJob(@Payload() data: Record<string, unknown>) {
    return this.jobs.create(data);
  }

  @MessagePattern({ cmd: AuthCommands.GetAccountExportJob })
  getExportJob(@Payload() data: Record<string, unknown>) {
    return this.jobs.get(data);
  }

  @MessagePattern({ cmd: AuthCommands.ResumeAccountExportJob })
  resumeExportJob(@Payload() data: Record<string, unknown>) {
    return this.jobs.resume(data);
  }

  @MessagePattern({ cmd: AuthCommands.CancelAccountExportJob })
  cancelExportJob(@Payload() data: Record<string, unknown>) {
    return this.jobs.cancel(data);
  }

  @MessagePattern({ cmd: AuthCommands.PreviewAccountExport })
  previewAccountExport(
    @Payload() data: { accountId?: unknown; token?: unknown; appId?: unknown }
  ) {
    return this.accountExport.previewAccountExport(
      data?.accountId,
      data?.token,
      data?.appId
    );
  }
}
