export const FLOW_CALCULATE_ESTIMATE = 'flow.calculate_estimate';
export const FLOW_CREATE_BOOKING = 'flow.create_booking';
export const FLOW_PROCESS_DEPOSIT = 'flow.process_deposit';
export const FLOW_GET_STATUS = 'flow.get_status';
export const FLOW_GET_AVAILABILITY = 'flow.get_availability';
export const FLOW_SYNC_PAYMENT = 'flow.sync_payment';
export const FLOW_SYNC_PAYMENT_STATUS = 'flow.sync_payment_status';
export const FLOW_SYNC = 'flow.sync';

export type FlowMessage =
  | typeof FLOW_CALCULATE_ESTIMATE
  | typeof FLOW_CREATE_BOOKING
  | typeof FLOW_PROCESS_DEPOSIT
  | typeof FLOW_GET_STATUS
  | typeof FLOW_GET_AVAILABILITY
  | typeof FLOW_SYNC_PAYMENT
  | typeof FLOW_SYNC_PAYMENT_STATUS
  | typeof FLOW_SYNC;

export type FlowTcpCommand = {
  readonly cmd: FlowMessage;
};

export const FlowCommands = {
  CALCULATE_ESTIMATE: { cmd: FLOW_CALCULATE_ESTIMATE },
  CREATE_BOOKING: { cmd: FLOW_CREATE_BOOKING },
  PROCESS_DEPOSIT: { cmd: FLOW_PROCESS_DEPOSIT },
  GET_STATUS: { cmd: FLOW_GET_STATUS },
  GET_AVAILABILITY: { cmd: FLOW_GET_AVAILABILITY },
  SYNC_PAYMENT: { cmd: FLOW_SYNC_PAYMENT },
  SYNC_PAYMENT_STATUS: { cmd: FLOW_SYNC_PAYMENT_STATUS },
  SYNC: { cmd: FLOW_SYNC },
} as const satisfies Record<string, FlowTcpCommand>;

export const FlowTcpCommands = FlowCommands;
export const FlowCommandMap = FlowCommands;
export type FlowCommandMap = typeof FlowCommands;

export const FlowMessageCommands = {
  CALCULATE_ESTIMATE: FLOW_CALCULATE_ESTIMATE,
  CREATE_BOOKING: FLOW_CREATE_BOOKING,
  PROCESS_DEPOSIT: FLOW_PROCESS_DEPOSIT,
  GET_STATUS: FLOW_GET_STATUS,
  GET_AVAILABILITY: FLOW_GET_AVAILABILITY,
  SYNC_PAYMENT: FLOW_SYNC_PAYMENT,
  SYNC_PAYMENT_STATUS: FLOW_SYNC_PAYMENT_STATUS,
  SYNC: FLOW_SYNC,
} as const;
