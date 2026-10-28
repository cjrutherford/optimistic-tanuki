import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { planBindings } from '../../tools/repair-community-profile-binding.mjs';

const member = { id: 'm', userId: 'u', profileId: 'old', status: 'approved' };
const old = { id: 'old', userId: 'u', appScope: 'global' };
const target = { id: 'new', userId: 'u', appScope: 'client-interface' };
test('plans only verified approved legacy bindings', () => {
  assert.equal(
    planBindings(
      [
        member,
        { ...member, id: 'modern', profileId: 'new' },
        { ...member, id: 'pending', status: 'pending' },
      ],
      [old, target],
      'client-interface'
    ).length,
    1
  );
});
test('rejects wrong-account source and ambiguous targets', () => {
  assert.throws(() =>
    planBindings(
      [member],
      [{ ...old, userId: 'other' }, target],
      'client-interface'
    )
  );
  assert.throws(() =>
    planBindings(
      [member],
      [old, target, { ...target, id: 'other' }],
      'client-interface'
    )
  );
});
