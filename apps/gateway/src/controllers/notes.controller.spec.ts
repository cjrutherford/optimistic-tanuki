import { Test, TestingModule } from '@nestjs/testing';
import { NotesController } from './notes.controller';
import { NotesCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateNoteDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

describe('NotesController', () => {
  let controller: NotesController;
  let mockClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotesController],
      providers: [
        {
          provide: ServiceTokens.TASKS_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation((pattern, data) => {
              // Mock iplementation of the send method
              return Promise.resolve({ success: true, pattern, data });
            }),
          },
        },
      ],
    }).compile();
    mockClient = module.get(ServiceTokens.TASKS_SERVICE);
    controller = module.get<NotesController>(NotesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Example CRUD tests (to be expanded with real logic/mocks)
  describe('Create Note', () => {
    it('should successfully create a note', async () => {
      const createNoteDto: CreateNoteDto = {
        title: 'Test Note',
        contents: 'This is a test note.',
        userId: '123',
        taskId: '456',
        description: 'Test description',
      };
      const result = await controller.create(createNoteDto);
      expect(result).toEqual({
        success: true,
        pattern: { cmd: NotesCommands.CREATE },
        data: createNoteDto,
      });
      expect(mockClient.send).toHaveBeenCalledWith(
        { cmd: NotesCommands.CREATE },
        createNoteDto
      );
    });

    // it('should ')
  });

  describe('get a note', () => {
    it('should successfully retrieve a note by ID', async () => {
      const noteId = '123';
      const result = await controller.findOne(noteId);
      expect(result).toEqual({
        success: true,
        pattern: { cmd: NotesCommands.FIND_ONE },
        data: noteId,
      });
      expect(mockClient.send).toHaveBeenCalledWith(
        { cmd: NotesCommands.FIND_ONE },
        noteId
      );
    });
  });

  describe('update a note', () => {
    it('should successfully update a note by ID', async () => {
      const noteId = '123';
      const updateNoteDto = {
        title: 'Updated Note',
        contents: 'Updated contents',
      };
      const result = await controller.update(noteId, updateNoteDto);
      expect(result).toEqual({
        success: true,
        pattern: { cmd: NotesCommands.UPDATE },
        data: { id: noteId, data: updateNoteDto },
      });
      expect(mockClient.send).toHaveBeenCalledWith(
        { cmd: NotesCommands.UPDATE },
        { id: noteId, data: updateNoteDto }
      );
    });
  });

  describe('delete a note', () => {
    it('should successfully delete a note by ID', async () => {
      const noteId = '123';
      const result = await controller.remove(noteId);
      expect(result).toEqual({
        success: true,
        pattern: { cmd: NotesCommands.DELETE },
        data: noteId,
      });
      expect(mockClient.send).toHaveBeenCalledWith(
        { cmd: NotesCommands.DELETE },
        noteId
      );
    });
  });
});
