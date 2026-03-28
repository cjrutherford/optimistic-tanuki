export const HardwareCommands = {
  FIND_ALL_CHASSIS: 'hardware.findAllChassis',
  FIND_CHASSIS_BY_ID: 'hardware.findChassisById',
  GET_COMPATIBLE_COMPONENTS: 'hardware.getCompatibleComponents',
  FIND_ALL_COMPONENTS: 'hardware.findAllComponents',
  FIND_COMPONENT_BY_ID: 'hardware.findComponentById',
  VALIDATE_CONFIG: 'hardware.validateConfig',
  CALCULATE_PRICE: 'hardware.calculatePrice',
  CALCULATE_DETAILED_PRICE: 'hardware.calculateDetailedPrice',
  CREATE_ORDER: 'hardware.createOrder',
  FIND_ALL_ORDERS: 'hardware.findAllOrders',
  FIND_ORDER_BY_ID: 'hardware.findOrderById',
  UPDATE_ORDER_STATUS: 'hardware.updateOrderStatus',
} as const;
