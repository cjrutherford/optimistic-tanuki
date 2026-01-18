import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ApproveAppointmentDto,
  DenyAppointmentDto,
} from '@optimistic-tanuki/models';
import { AppointmentsService } from './appointments.service';

@Controller()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @MessagePattern({ cmd: 'createAppointment' })
  create(@Payload() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @MessagePattern({ cmd: 'findAllAppointments' })
  findAll() {
    return this.appointmentsService.findAll();
  }

  @MessagePattern({ cmd: 'findUserAppointments' })
  findUserAppointments(@Payload() userId: string) {
    return this.appointmentsService.findUserAppointments(userId);
  }

  @MessagePattern({ cmd: 'findOneAppointment' })
  findOne(@Payload() id: string) {
    return this.appointmentsService.findOne(id);
  }

  @MessagePattern({ cmd: 'updateAppointment' })
  update(
    @Payload() data: { id: string; updateAppointmentDto: UpdateAppointmentDto }
  ) {
    return this.appointmentsService.update(data.id, data.updateAppointmentDto);
  }

  @MessagePattern({ cmd: 'approveAppointment' })
  approve(
    @Payload() data: { id: string; approveAppointmentDto: ApproveAppointmentDto }
  ) {
    return this.appointmentsService.approve(data.id, data.approveAppointmentDto);
  }

  @MessagePattern({ cmd: 'denyAppointment' })
  deny(@Payload() data: { id: string; denyAppointmentDto: DenyAppointmentDto }) {
    return this.appointmentsService.deny(data.id, data.denyAppointmentDto);
  }

  @MessagePattern({ cmd: 'cancelAppointment' })
  cancel(@Payload() id: string) {
    return this.appointmentsService.cancel(id);
  }

  @MessagePattern({ cmd: 'completeAppointment' })
  complete(@Payload() id: string) {
    return this.appointmentsService.complete(id);
  }

  @MessagePattern({ cmd: 'generateInvoice' })
  generateInvoice(@Payload() id: string) {
    return this.appointmentsService.generateInvoice(id);
  }
}
