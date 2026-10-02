import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import {
  CommunityCommands,
  type Actor,
  type ApplyOfficialRequest,
  type CounterNoticeRequest,
  type SubmitRequest,
  type TakedownNoticeRequest,
} from '@optimistic-tanuki/civic-community';
import type { ActorWithRoles } from './corroboration-access';
import { CopyrightService, NoticeError } from './copyright.service';
import { DensityService } from './density.service';
import { CorpusService } from './corpus.service';
import { IntakeService } from './intake.service';
import { OfficialsService } from './officials.service';
import { OutcomeService } from './outcome.service';
import { PromotionService } from './promotion.service';
import { SurfaceService } from './surface.service';

/**
 * The service's messages. Who is acting always arrives from the gateway,
 * which established it from the session; nothing here trusts a body for it.
 * Failures meant for a person travel back as their message, which the
 * gateway shows; anything else is logged and reported generically.
 */
@Controller()
export class CommunityController {
  private readonly logger = new Logger(CommunityController.name);

  constructor(
    private readonly corpus: CorpusService,
    private readonly intake: IntakeService,
    private readonly officials: OfficialsService,
    private readonly copyright: CopyrightService,
    private readonly surfaceService: SurfaceService,
    private readonly outcomes: OutcomeService,
    private readonly promotion: PromotionService,
    private readonly densityService: DensityService
  ) {}

  @MessagePattern({ cmd: CommunityCommands.Subjects })
  subjects(@Payload() data: { localitySlug: string }) {
    return this.guard(() => this.corpus.subjects(data.localitySlug));
  }

  @MessagePattern({ cmd: CommunityCommands.Submit })
  submit(@Payload() data: SubmitRequest & { actor: ActorWithRoles }) {
    return this.guard(() => this.intake.submit(data));
  }

  @MessagePattern({ cmd: CommunityCommands.Mine })
  mine(@Payload() data: { actor: Actor }) {
    return this.guard(() => this.intake.mine(data.actor));
  }

  @MessagePattern({ cmd: CommunityCommands.Withdraw })
  withdraw(@Payload() data: { actor: Actor; id: string }) {
    return this.guard(() => this.intake.withdraw(data.actor, data.id));
  }

  @MessagePattern({ cmd: CommunityCommands.ApplyOfficial })
  applyOfficial(@Payload() data: ApplyOfficialRequest) {
    return this.guard(() => this.officials.apply(data));
  }

  @MessagePattern({ cmd: CommunityCommands.ConfirmOfficialCallback })
  confirmCallback(
    @Payload()
    data: {
      userId: string;
      localitySlug: string;
      operator: string;
      note: string;
    }
  ) {
    return this.guard(() => this.officials.confirmCallback(data));
  }

  @MessagePattern({ cmd: CommunityCommands.FileTakedownNotice })
  fileNotice(@Payload() data: TakedownNoticeRequest) {
    return this.guard(() => this.copyright.file(data));
  }

  @MessagePattern({ cmd: CommunityCommands.ListTakedownNotices })
  listNotices(@Payload() data: { state?: string }) {
    return this.guard(() => this.copyright.list(data?.state));
  }

  @MessagePattern({ cmd: CommunityCommands.ActOnTakedownNotice })
  actOnNotice(
    @Payload()
    data: {
      noticeId: string;
      action: 'upheld' | 'declined' | 'restored';
      operator: string;
      note: string;
    }
  ) {
    return this.guard(() => this.copyright.act(data));
  }

  @MessagePattern({ cmd: CommunityCommands.FileCounterNotice })
  counterNotice(@Payload() data: CounterNoticeRequest) {
    return this.guard(() => this.copyright.counter(data));
  }

  @MessagePattern({ cmd: CommunityCommands.Surface })
  surface(@Payload() data: { localitySlug: string }) {
    return this.guard(() => this.surfaceService.surface(data.localitySlug));
  }

  @MessagePattern({ cmd: CommunityCommands.ContributorPage })
  contributorPage(@Payload() data: { contributorId: string }) {
    return this.guard(() =>
      this.surfaceService.contributorPage(data.contributorId)
    );
  }

  @MessagePattern({ cmd: CommunityCommands.Artifact })
  artifact(@Payload() data: { sha256: string }) {
    return this.guard(() => this.surfaceService.artifact(data.sha256));
  }

  /** The operator can run the re-review sweep now rather than waiting for its interval. */
  @MessagePattern({ cmd: CommunityCommands.Rereview })
  rereview() {
    return this.guard(async () => ({ changed: await this.intake.rereview() }));
  }

  /** The operator can compare reports against the records published since, rather than waiting for the sweep. */
  @MessagePattern({ cmd: CommunityCommands.SweepOutcomes })
  sweepOutcomes() {
    return this.guard(() => this.outcomes.sweep());
  }

  /** Writes the snapshots of quotable material the pipeline reads. */
  @MessagePattern({ cmd: CommunityCommands.ExportPromotions })
  exportPromotions() {
    return this.guard(async () => ({ towns: await this.promotion.writeAll() }));
  }

  /** Contributor density per town, for the operator page and the weekly report. */
  @MessagePattern({ cmd: CommunityCommands.Density })
  density(@Payload() data: { write?: boolean }) {
    return this.guard(async () =>
      data?.write
        ? await this.densityService.writeReport()
        : { week: null, path: null, rows: await this.densityService.density() }
    );
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof NoticeError)
        throw new RpcException(`NOTICE: ${error.message}`);
      this.logger.error(
        error instanceof Error ? error.stack ?? error.message : String(error)
      );
      throw new RpcException(
        error instanceof Error ? error.message : 'community service error'
      );
    }
  }
}
