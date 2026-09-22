import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Follow graph edges. Field names match `FollowEntity` (`followerId`,
 * `followeeId`) — not the `followingId` spelling used in some gateway
 * handlers, which migrates onto this contract with its consumers.
 */
export class FollowEdgeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  followerId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  followeeId!: string;
}

/** `FollowCommands.FOLLOW`. */
export class FollowUserDto extends FollowEdgeDto {}

/** `FollowCommands.UNFOLLOW`. */
export class UnfollowUserDto extends FollowEdgeDto {}

/** Follower/following/count reads share one shape: whose graph. */
export class FollowGraphDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;
}
