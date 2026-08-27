import {
  extractFinanceScope,
  mergeScopedWhere,
  withScopeWhere,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

describe('finance-scope', () => {
  describe('extractFinanceScope', () => {
    it('returns undefined for an empty payload', () => {
      expect(extractFinanceScope(undefined)).toBeUndefined();
      expect(extractFinanceScope(null)).toBeUndefined();
      expect(extractFinanceScope({})).toBeUndefined();
    });

    it('pulls only the known scope keys off the payload', () => {
      expect(
        extractFinanceScope({
          userId: 'user-1',
          profileId: 'profile-1',
          tenantId: 'tenant-1',
          appScope: 'finance',
          extra: 'ignored',
        })
      ).toEqual({
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      });
    });
  });

  describe('withScopeWhere', () => {
    it('lets scope values win when the base where-clause tries to override them', () => {
      const result = withScopeWhere(
        {
          tenantId: 'attacker-tenant',
          profileId: 'attacker-profile',
          id: 'row-1',
        },
        { tenantId: 'real-tenant', profileId: 'real-profile' }
      );

      expect(result).toEqual({
        id: 'row-1',
        tenantId: 'real-tenant',
        profileId: 'real-profile',
      });
    });

    it('leaves non-scope base keys untouched, e.g. a workspace filter', () => {
      const result = withScopeWhere(
        { workspace: 'business' },
        { tenantId: 'real-tenant', profileId: 'real-profile' }
      );

      expect(result).toEqual({
        workspace: 'business',
        tenantId: 'real-tenant',
        profileId: 'real-profile',
      });
    });

    it('applies no scope keys when scope is absent', () => {
      const result = withScopeWhere({ id: 'row-1' }, undefined);
      expect(result).toEqual({ id: 'row-1' });
    });
  });

  describe('mergeScopedWhere', () => {
    it('applies scope to every entry of an array where-clause and cannot be overridden', () => {
      const result = mergeScopedWhere(
        [
          { id: 'row-1', tenantId: 'attacker-tenant' },
          { id: 'row-2', tenantId: 'attacker-tenant' },
        ],
        { tenantId: 'real-tenant' }
      );

      expect(result).toEqual([
        { id: 'row-1', tenantId: 'real-tenant' },
        { id: 'row-2', tenantId: 'real-tenant' },
      ]);
    });

    it('returns the original where-clause untouched when no scope is provided', () => {
      const where = { id: 'row-1' };
      expect(mergeScopedWhere(where, undefined)).toBe(where);
    });
  });

  describe('withScopedFindOneOptions', () => {
    it('scopes a find-one lookup and prevents scope override via id-adjacent keys', () => {
      const options = withScopedFindOneOptions('row-1', {
        tenantId: 'real-tenant',
        profileId: 'real-profile',
      });

      expect(options).toEqual({
        where: {
          id: 'row-1',
          tenantId: 'real-tenant',
          profileId: 'real-profile',
        },
      });
    });
  });

  describe('withScopedFindManyOptions', () => {
    it('keeps a workspace filter from the caller while enforcing tenant scope', () => {
      const options = withScopedFindManyOptions(
        { tenantId: 'real-tenant', profileId: 'real-profile' },
        { where: { workspace: 'business', tenantId: 'attacker-tenant' } }
      );

      expect(options).toEqual({
        where: {
          workspace: 'business',
          tenantId: 'real-tenant',
          profileId: 'real-profile',
        },
      });
    });

    it('passes through find options untouched when no scope is present', () => {
      const options = withScopedFindManyOptions(undefined, {
        where: { workspace: 'business' },
      });

      expect(options).toEqual({ where: { workspace: 'business' } });
    });
  });
});
