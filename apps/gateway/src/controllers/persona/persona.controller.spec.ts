import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { PersonaController } from './persona.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { PersonaTelosDto } from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';

describe('PersonaController', () => {
  let controller: PersonaController;
  let telosClient: ClientProxy;

  const mockPersona: PersonaTelosDto = {
    id: '123',
    name: 'Project Management',
    description: 'A persona specialized in project management',
    goals: ['Manage projects effectively'],
    skills: ['Planning', 'Organizing', 'Communication'],
    interests: ['Project success'],
    limitations: [],
    strengths: ['Strategic thinking'],
    objectives: ['Deliver on time'],
    coreObjective: 'Ensure project success',
    exampleResponses: [],
    promptTemplate: 'You are a project management assistant',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonaController],
      providers: [
        Logger,
        {
          provide: ServiceTokens.TELOS_DOCS_SERVICE,
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PersonaController>(PersonaController);
    telosClient = module.get<ClientProxy>(ServiceTokens.TELOS_DOCS_SERVICE);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllPersonas', () => {
    it('should return an array of personas', async () => {
      const personas = [mockPersona];
      jest.spyOn(telosClient, 'send').mockReturnValue(of(personas));

      const result = await controller.getAllPersonas({});

      expect(result).toEqual(personas);
      expect(telosClient.send).toHaveBeenCalledWith(
        { cmd: 'PERSONA:FIND' },
        {}
      );
    });

    it('should pass query parameters to the service', async () => {
      const query = { name: 'Project Management' };
      jest.spyOn(telosClient, 'send').mockReturnValue(of([mockPersona]));

      await controller.getAllPersonas(query);

      expect(telosClient.send).toHaveBeenCalledWith(
        { cmd: 'PERSONA:FIND' },
        query
      );
    });
  });

  describe('getPersona', () => {
    it('should return a single persona by id', async () => {
      jest.spyOn(telosClient, 'send').mockReturnValue(of(mockPersona));

      const result = await controller.getPersona('123');

      expect(result).toEqual(mockPersona);
      expect(telosClient.send).toHaveBeenCalledWith(
        { cmd: 'PERSONA:FIND_ONE' },
        { id: '123' }
      );
    });
  });
});
