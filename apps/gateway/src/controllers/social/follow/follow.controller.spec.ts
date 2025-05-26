import { Test, TestingModule } from '@nestjs/testing';
import { FollowController } from './follow.controller';
import { of } from 'rxjs';

describe('FollowController', () => {
  let controller: FollowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowController],
      providers: [{
        provide: 'AUTHENTICATION_SERVICE',
        useValue: {
          send: jest.fn().mockImplementation(() => of({})),
        }
      },{
        provide: 'SOCIAL_SERVICE',
        useValue: {
          send: jest.fn().mockImplementation(() => of({})),
        },
      },{
        provide: 'PROFILE_SERVICE',
        useValue: {
          send: jest.fn().mockImplementation(() => of({})),
        },
      }]
    }).compile();

    controller = module.get<FollowController>(FollowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
