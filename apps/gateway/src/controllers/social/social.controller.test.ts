import { Test, TestingModule } from '@nestjs/testing';
import { SocialController } from './social.controller';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { 
AttachmentCommands, 
CommentCommands, 
PostCommands, 
VoteCommands 
} from '@optimistic-tanuki/constants';
import {
CreatePostDto, 
CreateVoteDto, 
CreateCommentDto, 
CreateAttachmentDto, 
SearchPostDto, 
SearchCommentDto, 
SearchAttachmentDto, 
UpdatePostDto, 
UpdateCommentDto, 
UpdateAttachmentDto 
} from '@optimistic-tanuki/models';

describe('SocialController', () => {
let socialController: SocialController;
let clientProxy: ClientProxy;
const mockUser = {
    id: '1',
    userId: '1',
    username: 'test',
    email: 'someone@somewhere.net',
    profileId: '1'
}

beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
        controllers: [SocialController],
        providers: [
            {
                provide: 'AUTHENTICATION_SERVICE',
                useValue: {
                    send: jest.fn().mockImplementation(() => of({})),
                }
            },
            {
                provide: 'SOCIAL_SERVICE',
                useValue: {
                    send: jest.fn().mockImplementation(() => of({})),
                },
            },
        ],
    }).compile();

    socialController = module.get<SocialController>(SocialController);
    clientProxy = module.get<ClientProxy>('SOCIAL_SERVICE');
});

it('should create a post', async () => {
    const postDto: CreatePostDto = { 
        title: 'Test Post', 
        content: 'Test Content', 
        userId: mockUser.id,
        profileId: mockUser.profileId,
     };
    await socialController.post(mockUser, postDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: PostCommands.CREATE }, postDto);
});

it('should create a vote', async () => {
    const voteDto: CreateVoteDto = { value: 1, postId: '1', userId: mockUser.id };
    await socialController.vote(mockUser, voteDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: VoteCommands.UPVOTE }, voteDto);
});

it('should create a comment', async () => {
    const commentDto: CreateCommentDto = { 
        content: 'Test Content', 
        userId: mockUser.id,
        postId: '1',
        profileId: mockUser.profileId
     };
    await socialController.comment(mockUser, commentDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: CommentCommands.CREATE }, commentDto);
});

it('should create an attachment', async () => {
    const attachmentDto: CreateAttachmentDto = { 
        url: 'http://test.com', 
        type: 'image', 
        post: '1',
     };
    await socialController.attachment(mockUser, attachmentDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: AttachmentCommands.CREATE }, attachmentDto);
});

it('should get a post by id', async () => {
    const id = '1';
    await socialController.getPost(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: PostCommands.FIND }, { id });
});

it('should get a comment by id', async () => {
    const id = '1';
    await socialController.getComment(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: CommentCommands.FIND }, { id });
});

it('should get a vote by id', async () => {
    const id = '1';
    await socialController.getVote(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: VoteCommands.GET }, { id });
});

it('should get an attachment by id', async () => {
    const id = '1';
    await socialController.getAttachment(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: AttachmentCommands.FIND }, { id });
});

it('should search posts', async () => {
    const searchCriteria: SearchPostDto = { 
        title: 'Test Post', 
        content: 'Test Content', 
        userId: mockUser.id,
     };
    await socialController.searchPosts(searchCriteria);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: PostCommands.FIND_MANY }, {
        criteria: searchCriteria,
        opts: undefined,
    });
});

it('should search comments', async () => {
    const searchCriteria: SearchCommentDto = { 
        content: 'Test Content', 
        parentId: '1',
     };
    await socialController.searchComments(searchCriteria);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: CommentCommands.FIND_MANY }, searchCriteria);
});

it('should search attachments', async () => {
    const searchCriteria: SearchAttachmentDto = { 
        filePath: 'http://test.com', 
        type: 'IMAGE', 
        description: '1',
     };
    await socialController.searchAttachments(searchCriteria);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: AttachmentCommands.FIND_MANY }, searchCriteria);
});

it('should update a post', async () => {
    const id = '1';
    const updatePostDto: UpdatePostDto = { /* mock data */ };
    await socialController.updatePost(id, updatePostDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: PostCommands.UPDATE }, { id, data: updatePostDto });
});

it('should update a comment', async () => {
    const id = '1';
    const updateCommentDto: UpdateCommentDto = { 
        content: 'Test Content', 
        userId: '1',
        postId: '1',
    };
    await socialController.updateComment(id, updateCommentDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: CommentCommands.UPDATE }, { id, data: updateCommentDto });
});

it('should update an attachment', async () => {
    const id = '1';
    const updateAttachmentDto: UpdateAttachmentDto = { 
        url: 'http://test.com', 
        type: 'IMAGE', 
        post: '1',
     };
    await socialController.updateAttachment(id, updateAttachmentDto);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: AttachmentCommands.UPDATE }, { id, data: updateAttachmentDto });
});

it('should delete a post', async () => {
    const id = '1';
    await socialController.deletePost(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: PostCommands.DELETE }, { id });
});

it('should delete a comment', async () => {
    const id = '1';
    await socialController.deleteComment(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: CommentCommands.DELETE }, { id });
});

it('should delete an attachment', async () => {
    const id = '1';
    await socialController.deleteAttachment(id);
    expect(clientProxy.send).toHaveBeenCalledWith({ cmd: AttachmentCommands.DELETE }, { id });
});
});