import axios, { AxiosInstance } from 'axios';
import { Logger } from '@nestjs/common';

interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  bio: string;
  profileName: string;
}

interface AuthenticatedUser {
  userId: string;
  profileId: string;
  token: string;
  email: string;
}

interface PostResponse {
  id: string;
  title: string;
  content: string;
  profileId: string;
  userId: string;
  communityId?: string;
}

interface CommunityResponse {
  id: string;
  name: string;
  ownerId: string;
}

interface CommentResponse {
  id: string;
  content: string;
  postId: string;
  profileId: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Johnson',
    password: 'TestPassword123!',
    bio: 'Software developer and tech enthusiast',
    profileName: 'Alice Johnson',
  },
  {
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Smith',
    password: 'TestPassword123!',
    bio: 'Full-stack developer | Open source contributor',
    profileName: 'Bob Smith',
  },
  {
    email: 'charlie@example.com',
    firstName: 'Charlie',
    lastName: 'Brown',
    password: 'TestPassword123!',
    bio: 'UI/UX Designer passionate about accessibility',
    profileName: 'Charlie Brown',
  },
  {
    email: 'diana@example.com',
    firstName: 'Diana',
    lastName: 'Prince',
    password: 'TestPassword123!',
    bio: 'Product manager | Agile enthusiast',
    profileName: 'Diana Prince',
  },
  {
    email: 'eve@example.com',
    firstName: 'Eve',
    lastName: 'Wilson',
    password: 'TestPassword123!',
    bio: 'DevOps engineer | Cloud architecture',
    profileName: 'Eve Wilson',
  },
];

const SAMPLE_POSTS = [
  {
    title: 'Welcome to the Community!',
    content:
      '<p>Hello everyone! Welcome to our social platform. This is the first post in our community. Feel free to share your thoughts, connect with others, and explore the features we have to offer.</p><p>We are excited to have you here!</p>',
  },
  {
    title: 'Tips for Getting Started',
    content:
      "<p>Here are some tips to help you get started:</p><ul><li>Complete your profile with a photo and bio</li><li>Follow other users to see their posts in your feed</li><li>Join communities that interest you</li><li>Don't be afraid to engage - comment and like posts!</li></ul>",
  },
  {
    title: 'Sharing My Latest Project',
    content:
      "<p>I just finished working on a new web application using NestJS and Angular. It's been a great learning experience!</p><p>The most challenging part was implementing real-time updates with WebSockets. But with the help of the community, I managed to get it working.</p>",
  },
  {
    title: 'Weekend Reading List',
    content:
      '<p>Here are some articles I\'ve been meaning to read:</p><ol><li>"The Future of Web Development" by Tech Weekly</li><li>"Building Scalable Microservices" - Oreilly Media</li><li>"Modern JavaScript Patterns" by JS Mastery</li></ol><p>Anyone else have recommendations?</p>',
  },
  {
    title: 'Question: Best Practices for API Design?',
    content:
      "<p>I'm working on a new API and wanted to gather some best practices from the community.</p><p>What are your go-to patterns for:</p><ul><li>RESTful endpoint naming</li><li>Error handling</li><li>Authentication/Authorization</li><li>Versioning</li></ul>",
  },
  {
    title: 'Photo from My Morning Hike',
    content:
      '<p>Just wanted to share this beautiful view from my morning hike. Nature always helps me clear my mind and get ready for the day ahead.</p><p>Anyone else here enjoy outdoor activities?</p>',
  },
  {
    title: 'New Feature Announcement',
    content:
      '<p>We are excited to announce a new feature - communities! Now you can create and join groups of like-minded individuals.</p><p>Features include:</p><ul><li>Create public or private communities</li><li>Invite other members</li><li>Community-specific posts and discussions</li><li>Moderation tools for admins</li></ul>',
  },
  {
    title: 'Coding Challenge: FizzBuzz',
    content:
      '<p>Here\'s a fun coding challenge for everyone - implement FizzBuzz!</p><p>The rules are simple:</p><ul><li>Print numbers 1 to 100</li><li>For multiples of 3, print "Fizz"</li><li>For multiples of 5, print "Buzz"</li><li>For multiples of both, print "FizzBuzz"</li></ul><p>Share your solutions in the comments!</p>',
  },
  {
    title: 'Thank You for 100 Followers!',
    content:
      "<p>I just reached 100 followers! Thank you all so much for your support.</p><p>This community has been amazing. I've learned so much from everyone here and look forward to continuing this journey together.</p>",
  },
  {
    title: 'Looking for Feedback on My Portfolio',
    content:
      "<p>I've been working on my portfolio website and would love some feedback from the community.</p><p>Currently it includes:</p><ul><li>About me section</li><li>Project showcase</li><li>Blog</li><li>Contact form</li></ul><p>What do you think? Any suggestions for improvement?</p>",
  },
];

const SEED_COMMUNITIES = [
  {
    name: 'DevEnthusiasts',
    description: 'A community for developers who love building cool things',
    isPrivate: false,
    joinPolicy: 'public',
  },
  {
    name: 'DesignMatters',
    description: 'Where designers share and discuss UI/UX trends',
    isPrivate: false,
    joinPolicy: 'public',
  },
  {
    name: 'TechNews',
    description: 'Stay up to date with the latest in tech',
    isPrivate: false,
    joinPolicy: 'public',
  },
];

const SAMPLE_COMMENTS = [
  'Great post! Thanks for sharing.',
  'I totally agree with this.',
  'This is really helpful, thank you!',
  'Interesting perspective. Never thought about it that way.',
  'Can you elaborate more on this?',
  'I had a similar experience!',
  'This is exactly what I was looking for.',
  'Nice work! Keep it up.',
  'Very informative, learned a lot.',
  'Could you provide some resources for this?',
];

const REACTION_VALUES = [1, 2, 3, 4, 5, 6]; // love, laugh, wow, sad, fire, clap

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bootstrap() {
  const logger = new Logger('SocialSeedScript-HTTP');

  // Support both external and internal gateway URLs
  const gatewayUrl =
    process.env.GATEWAY_URL ||
    process.env.API_URL ||
    'http://ot_gateway:3000/api';
  const appScope = process.env.APP_SCOPE || 'client-interface';

  logger.log(`=== Starting HTTP-based Social Seed ===`);
  logger.log(`Gateway URL: ${gatewayUrl}`);
  logger.log(`App Scope: ${appScope}`);

  const httpClient: AxiosInstance = axios.create({
    baseURL: gatewayUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'x-ot-appscope': appScope,
    },
  });

  // Test connectivity
  try {
    await httpClient.get('/health');
    logger.log('Gateway connectivity: OK');
  } catch (e) {
    logger.warn(
      `Gateway connectivity check failed: ${e}. Continuing anyway...`
    );
  }

  const authenticatedUsers: AuthenticatedUser[] = [];

  logger.log('=== Step 1: Register and Login Users ===');

  for (const userData of SEED_USERS) {
    let userId: string | undefined;
    let token: string | undefined;
    let profileId: string | undefined;

    // Try to register
    try {
      logger.log(`Registering user: ${userData.email}`);
      const registerResponse = await httpClient.post(
        '/authentication/register',
        {
          email: userData.email,
          fn: userData.firstName,
          ln: userData.lastName,
          password: userData.password,
          confirm: userData.password,
          bio: userData.bio,
        },
        {
          headers: {
            'x-ot-appscope': appScope,
          },
        }
      );

      logger.log(`Register response: ${JSON.stringify(registerResponse.data)}`);

      if (registerResponse.data?.data?.user?.id) {
        userId = registerResponse.data.data.user.id;
        logger.log(`Registered user: ${userData.email} (${userId})`);
      }
    } catch (registerError: any) {
      const errorMsg =
        registerError.response?.data?.message || registerError.message;
      const status = registerError.response?.status;

      if (status === 409 || errorMsg?.includes('already exists')) {
        logger.log(`User ${userData.email} already exists, logging in...`);
      } else {
        logger.warn(
          `Registration failed for ${userData.email} (status ${status}): ${errorMsg}`
        );
        // Continue to try login anyway
      }
    }

    // Small delay to allow any async operations to complete
    await sleep(200);

    // Try to login (works for both new and existing users)
    try {
      logger.log(`Logging in user: ${userData.email}`);
      const loginResponse = await httpClient.post('/authentication/login', {
        email: userData.email,
        password: userData.password,
      });

      logger.log(`Login response: ${JSON.stringify(loginResponse.data)}`);

      const data = loginResponse.data?.data || loginResponse.data;
      // Handle both 'token' and 'newToken' properties
      token = data?.token || data?.newToken;

      // Login response may only contain the token, we need to fetch user details
      if (!userId || !profileId) {
        logger.log(
          'Login response missing userId/profileId, fetching from token...'
        );
        try {
          // Try to get current user info from the authentication service
          const meResponse = await httpClient.get('/authentication/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          logger.log(`Me response: ${JSON.stringify(meResponse.data)}`);

          const meData = meResponse.data?.data || meResponse.data;
          userId = meData?.userId || meData?.id || userId;
        } catch (e: any) {
          logger.warn(
            `Could not fetch /authentication/me: ${
              e?.response?.data?.message || e.message
            }`
          );
        }
      }

      // If still no userId, try to decode from token (basic JWT decode)
      if (!userId && token) {
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            userId = payload?.sub || payload?.userId || payload?.user_id;
            logger.log(`Extracted userId from token: ${userId}`);
          }
        } catch (e) {
          logger.warn(`Could not decode token: ${e}`);
        }
      }

      logger.log(
        `Parsed login - token: ${
          token ? 'yes' : 'no'
        }, userId: ${userId}, profileId: ${profileId}`
      );

      if (!token) {
        logger.warn(`No token received for ${userData.email}, skipping...`);
        continue;
      }

      // Always try to get profile when we have a token (login may not return profileId)
      if (userId && token) {
        // Try to get profile by userId using different endpoints
        try {
          logger.log(`Fetching profile for userId: ${userId}`);

          // Try the profile service endpoint
          let profileResponse;
          try {
            profileResponse = await httpClient.get(`/profile/user/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (e) {
            // Try alternative endpoint - get all profiles and filter
            try {
              profileResponse = await httpClient.get(`/profile`, {
                headers: { Authorization: `Bearer ${token}` },
              });
            } catch (e2) {
              // Try with query param
              profileResponse = await httpClient.get(
                `/profile?userId=${userId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
            }
          }

          logger.log(
            `Profile response: ${JSON.stringify(profileResponse.data)}`
          );

          // Handle various response formats - find profile matching userId
          const profiles =
            profileResponse.data?.data || profileResponse.data || [];
          const matchingProfile = Array.isArray(profiles)
            ? profiles.find((p: any) => p.userId === userId)
            : profiles;

          profileId = matchingProfile?.id || profileId;
          logger.log(`Found profileId: ${profileId}`);
        } catch (e: any) {
          logger.warn(
            `Could not fetch profile for ${userData.email}: ${
              e?.response?.data?.message || e.message
            }`
          );
        }
      }

      logger.log(
        `Logged in: ${userData.email} (userId: ${userId}, profileId: ${profileId})`
      );

      if (userId && profileId && token) {
        authenticatedUsers.push({
          userId,
          profileId,
          token,
          email: userData.email,
        });
      } else {
        logger.warn(
          `Missing userId or profileId for ${userData.email}, skipping...`
        );
      }
    } catch (loginError: any) {
      logger.warn(
        `Login failed for ${userData.email}: ${
          loginError.response?.data?.message || loginError.message
        }`
      );
      continue;
    }

    await sleep(100);
  }

  if (authenticatedUsers.length === 0) {
    logger.error('No users could be authenticated. Aborting seed.');
    return;
  }

  logger.log(`Successfully authenticated ${authenticatedUsers.length} users`);

  logger.log('=== Step 2: Create/Join Communities ===');

  const createdCommunities: CommunityResponse[] = [];

  for (const communityData of SEED_COMMUNITIES) {
    const owner = authenticatedUsers[0];
    try {
      const communityResponse = await httpClient.post(
        '/social/community',
        communityData,
        {
          headers: {
            Authorization: `Bearer ${owner.token}`,
          },
        }
      );

      const community = communityResponse.data?.data || communityResponse.data;
      if (community?.id) {
        createdCommunities.push(community);
        logger.log(`Created community: ${community.name} (${community.id})`);
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        logger.log(
          `Community ${communityData.name} already exists, fetching...`
        );
        try {
          const searchResponse = await httpClient.get('/social/community', {
            params: { name: communityData.name },
            headers: { Authorization: `Bearer ${owner.token}` },
          });
          const existing =
            searchResponse.data?.data?.[0] || searchResponse.data?.[0];
          if (existing?.id) {
            createdCommunities.push(existing);
            logger.log(
              `Found existing community: ${existing.name} (${existing.id})`
            );
          }
        } catch (e) {
          logger.warn(`Could not fetch existing community: ${e}`);
        }
      } else {
        logger.warn(
          `Failed to create community ${communityData.name}: ${
            error.response?.data?.message || error.message
          }`
        );
      }
    }
    await sleep(50);
  }

  logger.log(`=== Step 3: Add Members to Communities ===`);

  for (const community of createdCommunities) {
    for (const user of authenticatedUsers) {
      try {
        await httpClient.post(
          `/social/community/${community.id}/join`,
          { profileId: user.profileId },
          {
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );
        logger.log(`User ${user.email} joined community ${community.name}`);
      } catch (error: any) {
        if (error.response?.status === 409) {
          logger.log(
            `User ${user.email} already in community ${community.name}`
          );
        } else {
          logger.debug(
            `Could not add ${user.email} to ${community.name}: ${error.message}`
          );
        }
      }
      await sleep(30);
    }
  }

  logger.log('=== Step 4: Create Posts ===');

  const createdPosts: PostResponse[] = [];

  for (let i = 0; i < authenticatedUsers.length; i++) {
    const user = authenticatedUsers[i];
    const postsToCreate = SAMPLE_POSTS.slice(i * 2, i * 2 + 2);

    for (const postData of postsToCreate) {
      try {
        const postPayload: any = {
          title: postData.title,
          content: postData.content,
          profileId: user.profileId,
          appScope: appScope,
        };

        // Add some posts to communities
        if (createdCommunities.length > 0 && Math.random() > 0.3) {
          const randomCommunity =
            createdCommunities[
              Math.floor(Math.random() * createdCommunities.length)
            ];
          postPayload.communityId = randomCommunity.id;
        }

        const postResponse = await httpClient.post(
          '/social/post',
          postPayload,
          {
            headers: { Authorization: `Bearer ${user.token}` },
          }
        );

        const post = postResponse.data?.data || postResponse.data;
        if (post?.id) {
          createdPosts.push(post);
          logger.log(
            `Created post: "${post.title || postData.title}" (${post.id})`
          );
        }
      } catch (error: any) {
        logger.warn(
          `Failed to create post "${postData.title}": ${
            error.response?.data?.message || error.message
          }`
        );
      }
      await sleep(50);
    }
  }

  // Create additional public posts
  const publicUser = authenticatedUsers[0];
  for (let i = 0; i < 3; i++) {
    const postData = SAMPLE_POSTS[SAMPLE_POSTS.length - 1 - i];
    if (!postData) continue;
    try {
      const postResponse = await httpClient.post(
        '/social/post',
        {
          title: postData.title,
          content: postData.content,
          profileId: publicUser.profileId,
          appScope: appScope,
          visibility: 'public',
        },
        { headers: { Authorization: `Bearer ${publicUser.token}` } }
      );
      const post = postResponse.data?.data || postResponse.data;
      if (post?.id) {
        createdPosts.push(post);
        logger.log(`Created public post: "${post.title}" (${post.id})`);
      }
    } catch (error: any) {
      logger.warn(`Failed to create public post: ${error.message}`);
    }
  }

  logger.log(`=== Step 5: Create Comments ===`);

  const createdComments: CommentResponse[] = [];

  for (const post of createdPosts) {
    // Add 1-3 comments per post
    const numComments = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < numComments; i++) {
      const randomUser =
        authenticatedUsers[
          Math.floor(Math.random() * authenticatedUsers.length)
        ];
      const commentContent =
        SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];

      try {
        const commentResponse = await httpClient.post(
          '/social/comment',
          {
            content: commentContent,
            postId: post.id,
            profileId: randomUser.profileId,
          },
          {
            headers: { Authorization: `Bearer ${randomUser.token}` },
          }
        );

        const comment = commentResponse.data?.data || commentResponse.data;
        if (comment?.id) {
          createdComments.push(comment);
          logger.log(
            `Created comment on post ${post.id}: "${commentContent.substring(
              0,
              30
            )}..."`
          );
        }
      } catch (error: any) {
        logger.warn(
          `Failed to create comment on post ${post.id}: ${
            error.response?.data?.message || error.message
          }`
        );
      }
      await sleep(30);
    }
  }

  logger.log('=== Step 6: Create Reactions ===');

  // Reaction to posts
  for (const post of createdPosts) {
    // Multiple users react to each post
    const reactors = authenticatedUsers.slice(
      0,
      Math.min(3, authenticatedUsers.length)
    );

    for (const reactor of reactors) {
      const reactionValue =
        REACTION_VALUES[Math.floor(Math.random() * REACTION_VALUES.length)];

      try {
        await httpClient.post(
          '/social/reaction',
          {
            value: reactionValue,
            profileId: reactor.profileId,
            postId: post.id,
          },
          {
            headers: { Authorization: `Bearer ${reactor.token}` },
          }
        );
        logger.log(
          `Added reaction ${reactionValue} to post ${post.id} by ${reactor.email}`
        );
      } catch (error: any) {
        // Reaction might already exist, that's OK
        logger.debug(
          `Could not add reaction to post ${post.id}: ${
            error.response?.data?.message || error.message
          }`
        );
      }
      await sleep(20);
    }
  }

  // Reaction to comments
  for (const comment of createdComments) {
    const randomUser =
      authenticatedUsers[Math.floor(Math.random() * authenticatedUsers.length)];
    const reactionValue =
      REACTION_VALUES[Math.floor(Math.random() * REACTION_VALUES.length)];

    try {
      await httpClient.post(
        '/social/reaction',
        {
          value: reactionValue,
          profileId: randomUser.profileId,
          commentId: comment.id,
        },
        {
          headers: { Authorization: `Bearer ${randomUser.token}` },
        }
      );
      logger.log(`Added reaction ${reactionValue} to comment ${comment.id}`);
    } catch (error: any) {
      logger.debug(
        `Could not add reaction to comment ${comment.id}: ${error.message}`
      );
    }
    await sleep(20);
  }

  logger.log('=== Step 7: Create Votes ===');

  // Upvote/downvote some posts
  for (const post of createdPosts) {
    const randomUser =
      authenticatedUsers[Math.floor(Math.random() * authenticatedUsers.length)];
    const voteValue = Math.random() > 0.5 ? 1 : -1;

    try {
      await httpClient.post(
        '/social/vote',
        {
          value: voteValue,
          profileId: randomUser.profileId,
          postId: post.id,
        },
        {
          headers: { Authorization: `Bearer ${randomUser.token}` },
        }
      );
      logger.log(
        `Added vote ${voteValue} to post ${post.id} by ${randomUser.email}`
      );
    } catch (error: any) {
      logger.debug(
        `Could not add vote to post ${post.id}: ${
          error.response?.data?.message || error.message
        }`
      );
    }
    await sleep(20);
  }

  logger.log(`=== Seed Complete ===`);
  logger.log(`Users: ${authenticatedUsers.length}`);
  logger.log(`Communities: ${createdCommunities.length}`);
  logger.log(`Posts: ${createdPosts.length}`);
  logger.log(`Comments: ${createdComments.length}`);

  // Summary of test credentials
  logger.log('=== Test Credentials ===');
  for (const user of authenticatedUsers) {
    logger.log(`Email: ${user.email}, Password: TestPassword123!`);
  }
}

bootstrap().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
