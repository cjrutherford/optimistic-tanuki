import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { CorpusQueryService } from './corpus-query.service';

/** Read-only corpus views for civic-contributions. */
@Controller()
export class CorpusController {
  constructor(private readonly corpus: CorpusQueryService) {}

  @MessagePattern({ cmd: CivicBriefingCommands.CORPUS_NEWS })
  news() {
    return this.corpus.news();
  }

  @MessagePattern({ cmd: CivicBriefingCommands.SUBJECTS })
  subjects(@Payload() payload: { localitySlug: string }) {
    return this.corpus.subjects(payload.localitySlug);
  }

  @MessagePattern({ cmd: CivicBriefingCommands.TOPIC_FOR })
  topicFor(
    @Payload()
    payload: {
      localitySlug: string;
      subject: { kind: string; ref: string | null };
    }
  ) {
    return this.corpus.topicFor(payload.localitySlug, payload.subject);
  }

  @MessagePattern({ cmd: CivicBriefingCommands.RECORDS_SINCE })
  recordsSince(
    @Payload() payload: { localitySlug: string; day: string; limit?: number }
  ) {
    return this.corpus.recordsSince(
      payload.localitySlug,
      payload.day,
      payload.limit
    );
  }
}
