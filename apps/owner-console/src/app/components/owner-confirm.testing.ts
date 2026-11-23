import type {
  OwnerConfirmOptions,
  OwnerConfirmResult,
} from '@optimistic-tanuki/owner-page-ui';

/** Test double for OwnerConfirmService. */
export interface OwnerConfirmStub {
  confirm: jest.Mock<Promise<OwnerConfirmResult>, [OwnerConfirmOptions]>;
}

/** Resolves every confirmation as accepted (with a reason) unless told not to. */
export function createOwnerConfirmStub(
  result: OwnerConfirmResult = { confirmed: true, reason: 'test reason' }
): OwnerConfirmStub {
  return { confirm: jest.fn().mockResolvedValue(result) };
}
