import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { isAccountExportCaptureGrant } from '@optimistic-tanuki/models';
import { DataSource } from 'typeorm';
import { AppService } from '../app/app.service';

@Injectable()
export class AccountExportCaptureLeaseService {
  constructor(
    private readonly auth: AppService,
    @Inject('AUTHENTICATION_CONNECTION') private readonly database: DataSource
  ) {}

  async validate(request: unknown): Promise<{ valid: true }> {
    if (!isAccountExportCaptureGrant(request)) this.deny();
    try {
      const session = await this.auth.validateToken(
        request.token,
        request.appId
      );
      if (
        session?.isValid !== true ||
        session.data?.userId !== request.accountId ||
        session.data?.appId !== request.appId
      )
        this.deny();
      const rows = await this.database.query(
        `SELECT EXISTS(SELECT 1 FROM "account_export_jobs"
          WHERE "id"=$1::uuid AND "accountId"=$2::uuid AND "appId"=$3
            AND "kind"='export' AND "state"='running' AND "attempt"=$4::integer
            AND "leaseOwner"=$5 AND "leaseExpiresAt">clock_timestamp()) AS "valid"`,
        [
          request.jobId,
          request.accountId,
          request.appId,
          request.attempt,
          request.leaseOwner,
        ]
      );
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.valid !== true)
        this.deny();
      return { valid: true };
    } catch {
      this.deny();
    }
  }

  private deny(): never {
    throw new RpcException({
      statusCode: 403,
      code: 'EXPORT_CAPTURE_NOT_AUTHORIZED',
      message: 'Export capture is not authorized',
    });
  }
}
