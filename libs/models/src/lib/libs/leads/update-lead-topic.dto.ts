import { PartialType } from '@nestjs/swagger';
import { CreateLeadTopicDto } from './create-lead-topic.dto';

export class UpdateLeadTopicDto extends PartialType(CreateLeadTopicDto) { }