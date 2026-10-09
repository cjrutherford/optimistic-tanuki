import { RpcException } from '@nestjs/microservices';
import { PostShareService } from './post-share.service';

describe('PostShareService', () => {
  const repository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  let service: PostShareService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostShareService(repository as any);
  });

  it('deletes only a share owned by the authenticated profile', async () => {
    repository.findOne.mockResolvedValue({
      id: 'share-id',
      sharedById: 'owner-profile',
    });
    await service.remove('share-id', 'owner-profile');
    expect(repository.delete).toHaveBeenCalledWith({
      id: 'share-id',
      sharedById: 'owner-profile',
    });
  });

  it('rejects deletion by another profile', async () => {
    repository.findOne.mockResolvedValue({
      id: 'share-id',
      sharedById: 'owner-profile',
    });
    let refusal: RpcException | undefined;
    try {
      await service.remove('share-id', 'other-profile');
    } catch (error) {
      refusal = error as RpcException;
    }
    expect(refusal).toBeInstanceOf(RpcException);
    expect(refusal?.getError()).toEqual({
      statusCode: 403,
      message: 'Only the share owner can delete it',
    });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('returns not found for missing shares', async () => {
    repository.findOne.mockResolvedValue(null);
    let refusal: RpcException | undefined;
    try {
      await service.remove('missing', 'owner-profile');
    } catch (error) {
      refusal = error as RpcException;
    }
    expect(refusal).toBeInstanceOf(RpcException);
    expect(refusal?.getError()).toEqual({
      statusCode: 404,
      message: 'Share not found',
    });
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
