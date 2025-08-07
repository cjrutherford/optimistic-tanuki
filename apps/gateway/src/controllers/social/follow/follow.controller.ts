import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ServiceTokens, FollowCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { UpdateFollowDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';


    /**
 * Controller for handling follow-related API requests.
 */
@Controller('follow')
export class FollowController {
    /**
     * Creates an instance of FollowController.
     * @param socialClient Client proxy for the social microservice.
     * @param profileClient Client proxy for the profile microservice.
     */
    constructor(
        @Inject(ServiceTokens.SOCIAL_SERVICE) private readonly socialClient: ClientProxy,
        @Inject(ServiceTokens.PROFILE_SERVICE) private readonly profileClient: ClientProxy,
    ){}


    /**
     * Allows a user to follow another user.
     * @param user The authenticated user details.
     * @param followDto The data for the follow relationship.
     * @returns A Promise that resolves to the follow response.
     * @throws Error if the profile is not found or if the follower ID does not match the authenticated user.
     */
    @UseGuards(AuthGuard)
    @ApiTags('follow')
    @ApiOperation({ summary: 'Follow a user' })
    @ApiResponse({ status: 201, description: 'The user has been successfully followed.' })
    @Post('/')
    async follow(@User() user: UserDetails, @Body() followDto: UpdateFollowDto) {
        const followingProfile = await firstValueFrom(this.profileClient.send({ cmd: ProfileCommands.Get }, { id: followDto.followerId }));
        if (!followingProfile) {
            throw new Error('Profile not found');
        }
        if(followingProfile.userId != user.userId) {
            console.log(followingProfile.userId, user.userId);
            throw new Error("You can't add a follow for someone else as the follower!")
        }
        return await firstValueFrom(this.socialClient.send({ cmd: FollowCommands.FOLLOW }, followDto));
    }

    /**
     * Allows a user to unfollow another user.
     * @param user The authenticated user details.
     * @param followDto The data for the unfollow relationship.
     * @returns A Promise that resolves to the unfollow response.
     * @throws Error if the profile is not found or if the follower ID does not match the authenticated user.
     */
    @UseGuards(AuthGuard)
    @ApiTags('follow')
    @ApiOperation({ summary: 'Unfollow a user' })
    @ApiResponse({ status: 201, description: 'The user has been successfully unfollowed.' })
    @Post('/unfollow')
    async unfollow(@User() user: UserDetails, @Body() followDto: UpdateFollowDto) {
        const followingProfile = await firstValueFrom(this.profileClient.send({ cmd: ProfileCommands.Get }, { id: followDto.followerId }));
        if (!followingProfile) {
            throw new Error('Profile not found');
        }
        if(followingProfile.userId !== user.userId) {
            throw new Error("You can't remove a follow for someone else as the follower!")
        }
        return await firstValueFrom(this.socialClient.send({ cmd: FollowCommands.UNFOLLOW }, followDto));
    }

    /**
     * Retrieves the followers of a user.
     * @param id The ID of the user whose followers are to be retrieved.
     * @returns A Promise that resolves to an array of followers.
     */
    @UseGuards(AuthGuard)
    @ApiTags('follow')
    @ApiOperation({ summary: 'Get followers of a user' })
    @ApiResponse({ status: 201, description: 'The followers have been successfully retrieved.' })
    @Get('/:id')
    async getFollowers(@Param('id') id: string) {
        return await firstValueFrom(this.socialClient.send({ cmd: FollowCommands.GET_FOLLOWERS }, { followeeId: id}));
    }

    /**
     * Retrieves the users that a user is following.
     * @param id The ID of the user whose following list is to be retrieved.
     * @returns A Promise that resolves to an array of users being followed.
     */
    @UseGuards(AuthGuard)
    @ApiTags('follow')
    @ApiOperation({ summary: 'Get following of a user' })
    @ApiResponse({ status: 201, description: 'The following have been successfully retrieved.' })
    @Get('/following/:id')
    async getFollowing(@Param('id') id: string) {
        return await firstValueFrom(this.socialClient.send({ cmd: FollowCommands.GET_FOLLOWING }, { followerId: id }));
    }

    /**
     * Retrieves mutual follows of a user.
     * @param id The ID of the user whose mutual follows are to be retrieved.
     * @returns A Promise that resolves to an array of mutual follows.
     */
    @UseGuards(AuthGuard)
    @ApiTags('follow')
    @ApiOperation({ summary: 'Get mutual follows of a user' })
    @ApiResponse({ status: 201, description: 'The mutual follows have been successfully retrieved.' })
    @Get('/mutuals/:id')
    async getMutuals(@Param('id') id: string) {
        return await firstValueFrom(this.socialClient.send({ cmd: FollowCommands.GET_MUTUALS }, { followerId: id }));
    }

    /**
     * Retrieves the count of users that a user is following.
     * @param id The ID of the user whose following count is to be retrieved.
     * @returns A Promise that resolves to the following count.
     */
    @UseGuards(AuthGuard)
    @ApiTags('follow')
    @ApiOperation({ summary: 'Get following count' })
    @ApiResponse({ status: 201, description: 'The following count has been successfully retrieved.' })
    @Get('/following/:id/count')
    async getFollowingCount(@Param('id') id: string) {
        return await firstValueFrom(this.socialClient.send({ cmd: FollowCommands.GET_FOLLOWING_COUNT }, { followerId: id }));
    }

    /**
     * Retrieves the follower count of a user.
     * @param id The ID of the user whose follower count is to be retrieved.
     * @returns A Promise that resolves to the follower count.
     */
    @UseGuards(AuthGuard)
    @ApiTags('follow')
    @ApiOperation({ summary: 'Get follower count' })
    @ApiResponse({ status: 201, description: 'The follower count has been successfully retrieved.' })
    @Get('/:id/count')
    async getFollowerCount(@Param('id') id: string) {
        return await firstValueFrom(this.socialClient.send({ cmd: FollowCommands.GET_FOLLOWER_COUNT }, { followeeId: id }));
    }
}