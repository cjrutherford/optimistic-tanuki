import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChangeService } from './change.service';
import { CreateChangeDto, QueryChangeDto, UpdateChangeDto } from '@optimistic-tanuki/models'
import { ChangeCommands } from '@optimistic-tanuki/constants';

/**
 * Controller for handling change-related operations.
 */
@Controller()
export class ChangeController {
  /**
   * Creates an instance of ChangeController.
   * @param changeService The service for managing changes.
   */
  constructor(private readonly changeService: ChangeService) {}

  /**
   * Creates a new change.
   * @param createChangeDto The data for creating the change.
   * @returns A Promise that resolves to the created change.
   */
  @MessagePattern({ cmd: ChangeCommands.CREATE })
  async create(@Payload() createChangeDto: CreateChangeDto) {
    return await this.changeService.create(createChangeDto);
  }

  /**
   * Finds all changes based on the provided query.
   * @param query The query criteria.
   * @returns A Promise that resolves to an array of changes.
   */
  @MessagePattern({ cmd: ChangeCommands.FIND_ALL })
  async findAll(@Payload() query: QueryChangeDto) {
    return await this.changeService.findAll(query);
  }

  /**
   * Finds a single change by its ID.
   * @param id The ID of the change to find.
   * @returns A Promise that resolves to the found change.
   */
  @MessagePattern({ cmd: ChangeCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.changeService.findOne(id);
  }

  /**
   * Updates an existing change.
   * @param updateChangeDto The data for updating the change.
   * @returns A Promise that resolves to the updated change.
   */
  @MessagePattern({ cmd: ChangeCommands.UPDATE })
  async update(@Payload() updateChangeDto: UpdateChangeDto) {
    return await this.changeService.update(updateChangeDto.id, updateChangeDto);
  }

  /**
   * Removes a change by its ID.
   * @param id The ID of the change to remove.
   * @returns A Promise that resolves when the change is removed.
   */
  @MessagePattern({ cmd: ChangeCommands.REMOVE })
  async remove(@Payload('id') id: string) {
    return await this.changeService.remove(id);
  }
}
