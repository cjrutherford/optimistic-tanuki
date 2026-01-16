const AppointmentCommands = {
  CREATE_APPOINTMENT: { cmd: 'createAppointment' },
  FIND_ALL_APPOINTMENTS: { cmd: 'findAllAppointments' },
  FIND_USER_APPOINTMENTS: { cmd: 'findUserAppointments' },
  FIND_ONE_APPOINTMENT: { cmd: 'findOneAppointment' },
  UPDATE_APPOINTMENT: { cmd: 'updateAppointment' },
  APPROVE_APPOINTMENT: { cmd: 'approveAppointment' },
  DENY_APPOINTMENT: { cmd: 'denyAppointment' },
  CANCEL_APPOINTMENT: { cmd: 'cancelAppointment' },
  COMPLETE_APPOINTMENT: { cmd: 'completeAppointment' },
  GENERATE_INVOICE: { cmd: 'generateInvoice' },
};

const AvailabilityCommands = {
  CREATE_AVAILABILITY: { cmd: 'createAvailability' },
  FIND_ALL_AVAILABILITIES: { cmd: 'findAllAvailabilities' },
  FIND_OWNER_AVAILABILITIES: { cmd: 'findOwnerAvailabilities' },
  FIND_ONE_AVAILABILITY: { cmd: 'findOneAvailability' },
  UPDATE_AVAILABILITY: { cmd: 'updateAvailability' },
  REMOVE_AVAILABILITY: { cmd: 'removeAvailability' },
};

export { AppointmentCommands, AvailabilityCommands };
