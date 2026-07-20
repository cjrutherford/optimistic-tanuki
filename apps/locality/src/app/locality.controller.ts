import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LocalityCommands } from '@optimistic-tanuki/constants';
import {
  LocalityAssessmentQueryDto,
  LocalityObservationInputDto,
} from '@optimistic-tanuki/models';
import { LocalityService } from './locality.service';

@Controller()
export class LocalityController {
  constructor(private readonly localityService: LocalityService) {}

  @MessagePattern({ cmd: LocalityCommands.RECORD_LOCALITY_OBSERVATION })
  recordObservation(@Payload() input: LocalityObservationInputDto) {
    return this.localityService.recordObservation(input);
  }

  @MessagePattern({ cmd: LocalityCommands.GET_LOCALITY_ASSESSMENT })
  getAssessment(@Payload() query: LocalityAssessmentQueryDto) {
    return this.localityService.getAssessment(query.subjectId, query.source);
  }
}
