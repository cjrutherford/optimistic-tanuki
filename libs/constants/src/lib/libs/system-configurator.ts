export const HardwareCommands = {
  GET_CHASSIS: 'system-configurator.hardware.getChassis',
  GET_CHASSIS_BY_ID: 'system-configurator.hardware.getChassisById',
  GET_COMPATIBLE_COMPONENTS:
    'system-configurator.hardware.getCompatibleComponents',
  CALCULATE_PRICE: 'system-configurator.hardware.calculatePrice',
  CREATE_ORDER: 'system-configurator.hardware.createOrder',
  GET_ORDER: 'system-configurator.hardware.getOrder',
  SAVE_CONFIGURATION: 'system-configurator.hardware.saveConfiguration',
  GET_CONFIGURATION: 'system-configurator.hardware.getConfiguration',
} as const;
