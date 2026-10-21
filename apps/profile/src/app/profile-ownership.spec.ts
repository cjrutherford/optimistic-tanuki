import { Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ProfileService } from './profile.service';

describe('ProfileService account profile ownership', () => {
  const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const profileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getExists: jest.fn(),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  let service: ProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfileService(
      repository as any,
      {} as any,
      {} as any,
      new Logger()
    );
  });

  it('returns owned for the matching account and profile', async () => {
    queryBuilder.getExists.mockResolvedValue(true);
    await expect(
      service.checkAccountProfileOwnership({ accountId, profileId })
    ).resolves.toEqual({
      accountId,
      profileId,
      owned: true,
    });
    expect(queryBuilder.select).toHaveBeenCalledWith('profile.id');
    expect(queryBuilder.where).toHaveBeenCalledWith('profile.id = :profileId', {
      profileId,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(profile.userId) = :accountId',
      { accountId }
    );
  });

  it('returns owned false for missing or foreign profiles', async () => {
    queryBuilder.getExists.mockResolvedValue(false);
    await expect(
      service.checkAccountProfileOwnership({ accountId, profileId })
    ).resolves.toMatchObject({ owned: false });
  });

  it('normalizes uppercase UUID input before querying and echoing', async () => {
    queryBuilder.getExists.mockResolvedValue(true);
    await expect(
      service.checkAccountProfileOwnership({
        accountId: accountId.toUpperCase(),
        profileId: profileId.toUpperCase(),
      })
    ).resolves.toEqual({ accountId, profileId, owned: true });
    expect(queryBuilder.where).toHaveBeenCalledWith('profile.id = :profileId', {
      profileId,
    });
  });

  it('rejects malformed UUID input without querying', async () => {
    await expect(
      service.checkAccountProfileOwnership({ accountId: 'bad', profileId })
    ).rejects.toBeInstanceOf(RpcException);
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
