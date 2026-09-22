import { OptomisitcTanukiAPIService } from './generated/store';

/**
 * Guards against tag-filter regressions silently dropping operations from
 * the generated client: all store routes must stay present.
 * NOTE: lives outside src/generated/ because orval `clean:true` wipes that
 * directory on every run.
 */
describe('generated store client operations', () => {
  it('exposes the catalog, product, order, and subscription operations', () => {
    for (const method of [
      'storeControllerFindMyCatalogs',
      'storeControllerCreateCatalog',
      'storeControllerCreateProduct',
      'storeControllerFindAllProducts',
      'storeControllerFindOneProduct',
      'storeControllerUpdateProduct',
      'storeControllerRemoveProduct',
      'storeControllerCreateOrder',
      'storeControllerFindAllOrders',
      'storeControllerFindOneOrder',
      'storeControllerFindUserOrders',
      'storeControllerUpdateOrder',
      'storeControllerFindAllSubscriptions',
      'storeControllerCreateSubscription',
      'storeControllerFindUserSubscriptions',
      'storeControllerCancelSubscription',
    ] as const) {
      expect(typeof OptomisitcTanukiAPIService.prototype[method]).toBe(
        'function'
      );
    }
  });

  it('exposes the appointment, availability, and resource operations', () => {
    for (const method of [
      'storeControllerCreateAppointment',
      'storeControllerFindAllAppointments',
      'storeControllerFindUserAppointments',
      'storeControllerFindOneAppointment',
      'storeControllerUpdateAppointment',
      'storeControllerApproveAppointment',
      'storeControllerDenyAppointment',
      'storeControllerCancelAppointment',
      'storeControllerCompleteAppointment',
      'storeControllerGenerateInvoice',
      'storeControllerCreateAvailability',
      'storeControllerFindAllAvailabilities',
      'storeControllerFindOwnerAvailabilities',
      'storeControllerFindOneAvailability',
      'storeControllerUpdateAvailability',
      'storeControllerRemoveAvailability',
      'storeControllerCreateResource',
      'storeControllerFindAllResources',
      'storeControllerFindResourcesByType',
      'storeControllerFindOneResource',
      'storeControllerUpdateResource',
      'storeControllerRemoveResource',
      'storeControllerCheckResourceAvailability',
    ] as const) {
      expect(typeof OptomisitcTanukiAPIService.prototype[method]).toBe(
        'function'
      );
    }
  });
});
