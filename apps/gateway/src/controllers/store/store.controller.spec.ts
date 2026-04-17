import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { StoreController } from './store.controller';

describe('Gateway StoreController metadata', () => {
  it('protects appointment cancellation with an explicit permission', () => {
    const handler = StoreController.prototype.cancelAppointment as unknown as Function;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
    const requirement = Reflect.getMetadata(PERMISSIONS_KEY, handler);

    expect(guards).toEqual(expect.arrayContaining([AuthGuard, PermissionsGuard]));
    expect(requirement).toEqual({
      permissions: ['store.appointment.cancel'],
    });
  });
});
