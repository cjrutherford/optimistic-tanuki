/**
 * Seed script: locality community posts
 *
 * Creates a city community (Savannah, GA), an interest sub-community
 * (Savannah Foodies), registers default users, seeds posts, comments,
 * votes, and reactions.
 *
 * Run via: docker compose exec social node /usr/src/app/seed-community-posts.js
 */

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

interface CommunityResponse {
  id: string;
  name: string;
  slug?: string;
  parentId?: string;
  ownerId: string;
}

interface PostResponse {
  id: string;
  title: string;
  content: string;
  profileId: string;
  communityId?: string;
}

interface CommentResponse {
  id: string;
  content: string;
  postId: string;
  profileId: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'savannah_local@example.com',
    firstName: 'Sam',
    lastName: 'Savannah',
    password: 'TestPassword123!',
    bio: 'Savannah native | History buff | Riverfront regular',
    profileName: 'Sam Savannah',
  },
  {
    email: 'foodie_grace@example.com',
    firstName: 'Grace',
    lastName: 'Foodies',
    password: 'TestPassword123!',
    bio: "Savannah's biggest foodie | Restaurant reviewer",
    profileName: 'Grace Foodies',
  },
  {
    email: 'tech_marcus@example.com',
    firstName: 'Marcus',
    lastName: 'Tech',
    password: 'TestPassword123!',
    bio: "Tech entrepreneur growing Savannah's startup scene",
    profileName: 'Marcus Tech',
  },
  {
    email: 'community_lily@example.com',
    firstName: 'Lily',
    lastName: 'Community',
    password: 'TestPassword123!',
    bio: 'Community organizer | Loves connecting neighbors',
    profileName: 'Lily Community',
  },
];

/** City-level community posts */
const CITY_POSTS = [
  {
    title: 'Welcome to Savannah, GA!',
    content:
      "<p>Welcome to the official Savannah community on Optimistic Tanuki! Whether you're a longtime resident or new to the Hostess City, this is your place to connect with neighbors, discover local events, and celebrate everything that makes Savannah special.</p><p>From the Historic Squares to the Riverfront, there's no shortage of things to love about this city. Let's keep the conversation going!</p>",
  },
  {
    title: "What's Happening Downtown This Weekend?",
    content:
      "<p>Savannah's downtown scene is buzzing this weekend. Here's a quick roundup:</p><ul><li>Saturday Farmers Market on Ellis Square (8am–1pm)</li><li>Ghost tour departures every evening at 8pm from City Market</li><li>Live music on the Riverfront all weekend</li><li>Free admission to the Telfair Museums on Sunday</li></ul><p>Drop your favorite local events in the comments!</p>",
  },
  {
    title: 'Savannah Housing Market Update',
    content:
      '<p>The Savannah housing market continues to attract attention from out-of-state buyers. Here are some observations from the community:</p><ul><li>Median home prices are up 8% year over year</li><li>The Victorian District is seeing significant renovation activity</li><li>New developments near SCAD continue to drive rental demand</li></ul><p>How has this impacted your neighborhood? Share your thoughts below.</p>',
  },
  {
    title: 'Favorite Spots to Watch the Sunset',
    content:
      "<p>One of the best things about Savannah is the scenery at golden hour. My top picks:</p><ol><li>Forsyth Park fountain area - magical in the evening light</li><li>River Street looking west over the Savannah River</li><li>Bonaventure Cemetery - hauntingly beautiful</li><li>Tybee Island Beach for the full coastal experience</li></ol><p>Where's your favorite sunset spot in or around Savannah?</p>",
  },
];

/** Interest sub-community (Savannah Foodies) posts */
const FOODIE_POSTS = [
  {
    title: "Hidden Gems: Savannah's Best Kept Dining Secrets",
    content:
      "<p>After years of eating my way around this city, here are my top hidden gem restaurants that locals love but tourists often miss:</p><ul><li><strong>Wiches of Savannah</strong> – Incredible sandwiches on Habersham, cash only</li><li><strong>Back in the Day Bakery</strong> – Best biscuits in the city, period</li><li><strong>Blowin' Smoke BBQ</strong> – Award-winning ribs on Gwinnett</li><li><strong>The Pie Society</strong> – British-style meat pies near the Historic District</li></ul><p>What's your secret local spot?</p>",
  },
  {
    title: 'Seasonal Lowcountry Boil Recipe - Serves 12!',
    content:
      "<p>Perfect for a Savannah backyard gathering! Here's my tried-and-true Lowcountry Boil recipe:</p><p><strong>Ingredients (serves 12):</strong></p><ul><li>3 lbs shrimp (local caught from Tybee if possible)</li><li>2 lbs smoked sausage, sliced</li><li>12 red potatoes, halved</li><li>6 ears corn, halved</li><li>Old Bay seasoning (generous amounts)</li><li>4 lemons, halved</li></ul><p>Start the potatoes first, add sausage after 10 min, then corn, then shrimp last. Drain and serve on newspaper on the table. Pure Savannah summer magic!</p>",
  },
  {
    title: 'Best Brunch Spots: Community Rankings',
    content:
      "<p>The community has voted! Here are Savannah's top brunch spots for 2024:</p><ol><li><strong>Collins Quarter</strong> – Consistently excellent, book ahead</li><li><strong>The Grey Market</strong> – Best biscuits and gravy in the city</li><li><strong>Fox &amp; Fig Café</strong> – Fantastic vegan options that even non-vegans love</li><li><strong>Alligator Soul</strong> – Upscale lowcountry brunch vibes</li><li><strong>Kayak Kafe</strong> – Great views on the Isle of Hope</li></ol><p>Agree or disagree? Cast your votes and comments below!</p>",
  },
  {
    title: "First Taste: Savannah's New Craft Brewery Scene",
    content:
      "<p>Savannah's craft beer scene has exploded in recent years. A roundup of the newest and best:</p><ul><li><strong>Service Brewing Co.</strong> – Veteran-owned, great seasonal IPAs</li><li><strong>Moon River Brewing</strong> – Historic building, haunted history, solid brews</li><li><strong>Southbound Brewing</strong> – Excellent lagers, located in the Starland District</li><li><strong>Savannah Taproom</strong> – Best selection of Georgia craft beers</li></ul><p>Which brewery is your go-to? Any newcomers I should add to the list?</p>",
  },
];

const SAMPLE_COMMENTS = [
  "This is spot on! I've been saying this for years.",
  'Great post, thanks for sharing with the community!',
  'I had no idea about this! Definitely checking it out.',
  'The Savannah community is the best. Love seeing posts like this.',
  'Adding this to my weekend plans for sure!',
  'Born and raised in Savannah - this is 100% accurate.',
  'New to the area and this is so helpful, thank you!',
  'My family has been going there for generations. Great recommendation.',
  "Can't wait to try this! Does anyone know the hours?",
  'Shared with the neighborhood Facebook group. Everyone should know!',
  'This made my day. Thank you for being part of this community.',
  'Beautiful photos would go great with this post.',
];

const REACTION_VALUES = [1, 2, 3, 4, 5, 6]; // love, laugh, wow, sad, fire, clap

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bootstrap() {
  const logger = new Logger('CommPostsSeed');

  const gatewayUrl =
    process.env.GATEWAY_URL ||
    process.env.API_URL ||
    'http://ot_gateway:3000/api';
  const appScope = process.env.APP_SCOPE || 'local-hub';

  logger.log('=== Starting Community Posts Seed (HTTP) ===');
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

  const getUserRoles = async (profileId: string, token: string) => {
    const response = await httpClient.get(
      `/permissions/user-roles/${profileId}`,
      {
        params: { appScope },
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data?.data || response.data;
  };

  const ensureRoleAssignment = async (
    role: any,
    profileId: string,
    token: string,
    targetId: string | null = null
  ) => {
    if (!role?.id) {
      return false;
    }

    const assignments = await getUserRoles(profileId, token);
    const alreadyAssigned = Array.isArray(assignments)
      ? assignments.some((assignment: any) => assignment.role?.id === role.id)
      : false;

    if (alreadyAssigned) {
      return false;
    }

    await httpClient.post(
      '/permissions/assignment',
      {
        roleId: role.id,
        profileId,
        appScopeId: role.appScope?.id || appScope,
        targetId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return true;
  };

  try {
    await httpClient.get('/health');
    logger.log('Gateway connectivity: OK');
  } catch {
    logger.warn('Gateway health check failed. Continuing anyway...');
  }

  // ── Step 1: Register and log in seed users ────────────────────────────────
  logger.log('=== Step 1: Register and Login Users ===');
  const authenticatedUsers: AuthenticatedUser[] = [];

  for (const userData of SEED_USERS) {
    let token: string | undefined;
    let userId: string | undefined;
    let profileId: string | undefined;

    try {
      await httpClient.post('/authentication/register', {
        email: userData.email,
        fn: userData.firstName,
        ln: userData.lastName,
        password: userData.password,
        confirm: userData.password,
        bio: userData.bio,
      });
      logger.log(`Registered: ${userData.email}`);
    } catch (err: any) {
      const status = err.response?.status;
      if (
        status === 409 ||
        err.response?.data?.message?.includes('already exists')
      ) {
        logger.log(`User ${userData.email} already exists, logging in...`);
      } else {
        logger.warn(`Register failed for ${userData.email}: ${err.message}`);
      }
    }
    await sleep(200);

    try {
      const loginRes = await httpClient.post('/authentication/login', {
        email: userData.email,
        password: userData.password,
      });
      const data = loginRes.data?.data || loginRes.data;
      token = data?.token || data?.newToken;

      if (token) {
        try {
          const meRes = await httpClient.get('/authentication/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const me = meRes.data?.data || meRes.data;
          userId = me?.userId || me?.id;
        } catch {
          /* ignore */
        }

        if (!profileId && token) {
          try {
            const profileRes = await httpClient.get('/profile/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const p = profileRes.data?.data || profileRes.data;
            profileId = p?.id;
            if (!userId) userId = p?.userId;
          } catch {
            /* ignore */
          }
        }

        // If still no profileId, try to create one directly
        if (!profileId && userId && token) {
          logger.log(
            `No profile found, creating profile for userId: ${userId}`
          );
          try {
            const createProfileRes = await httpClient.post(
              '/profile',
              {
                userId: userId,
                name: `${userData.firstName} ${userData.lastName}`,
                coverPic: '',
                profilePic: '',
                bio: userData.bio,
                location: '',
                description: '',
                occupation: '',
                interests: '',
                skills: '',
                appScope: appScope,
              },
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            const createdProfile =
              createProfileRes.data?.data || createProfileRes.data;
            profileId = createdProfile?.id;
            logger.log(`Created profile: ${profileId}`);
          } catch (e: any) {
            logger.warn(
              `Could not create profile: ${
                e?.response?.data?.message || e.message
              }`
            );
          }
        }

        if (userId && profileId && token) {
          authenticatedUsers.push({
            userId,
            profileId,
            token,
            email: userData.email,
          });
          logger.log(
            `Authenticated: ${userData.email} (profile: ${profileId})`
          );
        } else {
          logger.warn(
            `Could not get full details for ${userData.email} – skipping`
          );
        }
      }
    } catch (err: any) {
      logger.warn(`Login failed for ${userData.email}: ${err.message}`);
    }
    await sleep(100);
  }

  if (authenticatedUsers.length === 0) {
    logger.error('No users authenticated. Aborting seed.');
    return;
  }
  logger.log(`Authenticated ${authenticatedUsers.length} users`);

  // ── Step 1.5: Assign local_hub_admin role to seed user ────────────────────
  logger.log('=== Step 1.5: Assign local_hub_admin Role ===');
  const seedUser = authenticatedUsers[0];
  let localHubMemberRole: any = null;
  let localHubPosterRole: any = null;

  try {
    const rolesRes = await httpClient.get('/permissions/role', {
      headers: { Authorization: `Bearer ${seedUser.token}` },
    });
    const roles = rolesRes.data?.data || rolesRes.data;
    const localHubAdminRole = Array.isArray(roles)
      ? roles.find((r: any) => r.name === 'local_hub_admin')
      : null;
    localHubMemberRole = Array.isArray(roles)
      ? roles.find((r: any) => r.name === 'local_hub_member')
      : null;
    localHubPosterRole = Array.isArray(roles)
      ? roles.find((r: any) => r.name === 'local_hub_community_poster')
      : null;

    if (localHubAdminRole?.id) {
      try {
        const assigned = await ensureRoleAssignment(
          localHubAdminRole,
          seedUser.profileId,
          seedUser.token
        );
        logger.log(
          assigned
            ? `Assigned local_hub_admin role to ${seedUser.email}`
            : `User already has local_hub_admin role`
        );
      } catch (assignErr: any) {
        const message =
          assignErr.response?.data?.message || assignErr.message || '';
        if (
          assignErr.response?.status === 409 ||
          `${message}`.toLowerCase().includes('duplicate')
        ) {
          logger.log(`User already has local_hub_admin role`);
        } else {
          logger.warn(`Failed to assign role: ${assignErr.message}`);
        }
      }
    } else {
      logger.warn(`local_hub_admin role not found`);
    }

    for (const user of authenticatedUsers) {
      if (localHubMemberRole?.id) {
        await ensureRoleAssignment(
          localHubMemberRole,
          user.profileId,
          seedUser.token
        );
      }

      if (localHubPosterRole?.id) {
        await ensureRoleAssignment(
          localHubPosterRole,
          user.profileId,
          seedUser.token
        );
      }
    }
  } catch (roleErr: any) {
    logger.warn(`Failed to get roles: ${roleErr.message}`);
  }

  // ── Step 2: Ensure city community (Savannah, GA) exists ──────────────────
  logger.log('=== Step 2: Ensure City Community (Savannah, GA) ===');
  const owner = authenticatedUsers[0];
  let cityCommId: string | undefined;
  let cityCommSlug: string | undefined;

  try {
    const existing = await httpClient.get('/communities/slug/savannah-ga');
    const c = existing.data?.data || existing.data;
    if (c?.id) {
      cityCommId = c.id;
      cityCommSlug = c.slug;
      logger.log(`City community already exists: ${c.name} (${c.id})`);
    }
  } catch {
    /* doesn't exist yet */
  }

  if (!cityCommId) {
    try {
      const res = await httpClient.post(
        '/social/community',
        {
          name: 'Savannah, GA',
          slug: 'savannah-ga',
          description:
            "Georgia's oldest city, known for its stunning squares, antebellum architecture, and vibrant arts scene along the Savannah River.",
          localityType: 'city',
          countryCode: 'US',
          adminArea: 'GA',
          city: 'Savannah',
          lat: 31.9868,
          lng: -81.0982,
          population: 147780,
          isPrivate: false,
          joinPolicy: 'public',
          tags: ['Historic', 'Coastal', 'Arts'],
        },
        { headers: { Authorization: `Bearer ${owner.token}` } }
      );
      const c: CommunityResponse = res.data?.data || res.data;
      cityCommId = c.id;
      cityCommSlug = c.slug;
      logger.log(`Created city community: ${c.name} (${c.id})`);
    } catch (err: any) {
      logger.error(`Failed to create city community: ${err.message}`);
    }
  }

  if (!cityCommId) {
    logger.error('City community unavailable. Aborting.');
    return;
  }

  // ── Step 3: Ensure interest sub-community (Savannah Foodies) ─────────────
  logger.log('=== Step 3: Ensure Sub-Community (Savannah Foodies) ===');
  let foodieCommId: string | undefined;

  try {
    const existing = await httpClient.get('/communities/slug/savannah-foodies');
    const c = existing.data?.data || existing.data;
    if (c?.id) {
      foodieCommId = c.id;
      logger.log(`Foodies community already exists: ${c.name} (${c.id})`);
    }
  } catch {
    /* doesn't exist yet */
  }

  if (!foodieCommId) {
    try {
      const res = await httpClient.post(
        '/social/community',
        {
          name: 'Savannah Foodies',
          slug: 'savannah-foodies',
          description:
            "A community for Savannah's culinary enthusiasts. Share restaurant reviews, discover hidden gems, and connect with fellow food lovers.",
          localityType: 'neighborhood',
          countryCode: 'US',
          adminArea: 'GA',
          city: 'Savannah',
          lat: 31.992,
          lng: -81.091,
          population: 45000,
          isPrivate: false,
          joinPolicy: 'public',
          tags: ['Food', 'Dining', 'Reviews'],
          parentId: cityCommId,
        },
        { headers: { Authorization: `Bearer ${owner.token}` } }
      );
      const c: CommunityResponse = res.data?.data || res.data;
      foodieCommId = c.id;
      logger.log(`Created foodies community: ${c.name} (${c.id})`);
    } catch (err: any) {
      logger.warn(`Failed to create foodies community: ${err.message}`);
    }
  }

  // ── Step 4: Join users to both communities ────────────────────────────────
  logger.log('=== Step 4: Join Users to Communities ===');
  const communityIds = [cityCommId, foodieCommId].filter(Boolean) as string[];

  for (const commId of communityIds) {
    for (const user of authenticatedUsers) {
      try {
        await httpClient.post(
          `/social/community/${commId}/join`,
          { profileId: user.profileId },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        logger.log(`User ${user.email} joined community ${commId}`);
      } catch (err: any) {
        const message = err.response?.data?.message || err.message || '';
        if (
          err.response?.status === 409 ||
          `${message}`.includes('Already a member')
        ) {
          logger.log(`${user.email} already in community ${commId}`);
        } else {
          logger.debug(
            `Could not join ${user.email} to ${commId}: ${err.message}`
          );
        }
      }

      await sleep(30);
    }
  }

  // ── Step 5: Create city community posts ───────────────────────────────────
  logger.log('=== Step 5: Create City Community Posts ===');
  const allPosts: PostResponse[] = [];

  for (let i = 0; i < CITY_POSTS.length; i++) {
    const postData = CITY_POSTS[i];
    const user = authenticatedUsers[i % authenticatedUsers.length];
    try {
      const res = await httpClient.post(
        '/social/post',
        {
          title: postData.title,
          content: postData.content,
          profileId: user.profileId,
          communityId: cityCommId,
          appScope,
        },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      const post: PostResponse = res.data?.data || res.data;
      if (post?.id) {
        allPosts.push(post);
        logger.log(`Created city post: "${post.title}" (${post.id})`);
      }
    } catch (err: any) {
      logger.warn(
        `Failed to create city post "${postData.title}": ${err.message}`
      );
    }
    await sleep(50);
  }

  // ── Step 6: Create foodies sub-community posts ────────────────────────────
  if (foodieCommId) {
    logger.log('=== Step 6: Create Foodies Community Posts ===');
    for (let i = 0; i < FOODIE_POSTS.length; i++) {
      const postData = FOODIE_POSTS[i];
      const user = authenticatedUsers[i % authenticatedUsers.length];
      try {
        const res = await httpClient.post(
          '/social/post',
          {
            title: postData.title,
            content: postData.content,
            profileId: user.profileId,
            communityId: foodieCommId,
            appScope,
          },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        const post: PostResponse = res.data?.data || res.data;
        if (post?.id) {
          allPosts.push(post);
          logger.log(`Created foodies post: "${post.title}" (${post.id})`);
        }
      } catch (err: any) {
        logger.warn(
          `Failed to create foodies post "${postData.title}": ${err.message}`
        );
      }
      await sleep(50);
    }
  }

  // ── Step 7: Create comments on posts ─────────────────────────────────────
  logger.log('=== Step 7: Create Comments ===');
  const createdComments: CommentResponse[] = [];
  let commentsEnabled = true;

  for (const post of allPosts) {
    if (!commentsEnabled) {
      break;
    }

    const numComments = Math.floor(Math.random() * 4) + 2; // 2–5 comments per post
    for (let i = 0; i < numComments; i++) {
      if (!commentsEnabled) {
        break;
      }

      const user =
        authenticatedUsers[
          Math.floor(Math.random() * authenticatedUsers.length)
        ];
      const content =
        SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];
      try {
        const res = await httpClient.post(
          '/social/comment',
          {
            content,
            postId: post.id,
            profileId: user.profileId,
          },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        const comment: CommentResponse = res.data?.data || res.data;
        if (comment?.id) {
          createdComments.push(comment);
          logger.log(`Added comment on post ${post.id}`);
        }
      } catch (err: any) {
        if (err.response?.status === 403) {
          commentsEnabled = false;
          logger.warn(
            'Skipping remaining comment seed because local-hub users do not currently have comment permission.'
          );
          break;
        }
        logger.debug(`Could not add comment: ${err.message}`);
      }
      await sleep(20);
    }
  }

  // ── Step 8: Add reactions to posts ────────────────────────────────────────
  logger.log('=== Step 8: Add Reactions to Posts ===');
  for (const post of allPosts) {
    const user =
      authenticatedUsers[Math.floor(Math.random() * authenticatedUsers.length)];
    const reactionValue =
      REACTION_VALUES[Math.floor(Math.random() * REACTION_VALUES.length)];
    try {
      await httpClient.post(
        '/social/reaction',
        {
          value: reactionValue,
          profileId: user.profileId,
          postId: post.id,
        },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      logger.log(`Added reaction ${reactionValue} to post ${post.id}`);
    } catch (err: any) {
      logger.debug(`Could not react to post ${post.id}: ${err.message}`);
    }
    await sleep(20);
  }

  // ── Step 9: Add reactions to comments ────────────────────────────────────
  logger.log('=== Step 9: Add Reactions to Comments ===');
  for (const comment of createdComments) {
    if (Math.random() < 0.5) continue; // react to ~50% of comments
    const user =
      authenticatedUsers[Math.floor(Math.random() * authenticatedUsers.length)];
    const reactionValue =
      REACTION_VALUES[Math.floor(Math.random() * REACTION_VALUES.length)];
    try {
      await httpClient.post(
        '/social/reaction',
        {
          value: reactionValue,
          profileId: user.profileId,
          commentId: comment.id,
        },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      logger.log(`Added reaction ${reactionValue} to comment ${comment.id}`);
    } catch (err: any) {
      logger.debug(`Could not react to comment ${comment.id}: ${err.message}`);
    }
    await sleep(20);
  }

  // ── Step 10: Add votes to posts ────────────────────────────────────────────
  logger.log('=== Step 10: Add Votes to Posts ===');
  let votesEnabled = true;
  for (const post of allPosts) {
    if (!votesEnabled) {
      break;
    }

    const user =
      authenticatedUsers[Math.floor(Math.random() * authenticatedUsers.length)];
    const voteValue = Math.random() > 0.2 ? 1 : -1; // mostly upvotes
    try {
      await httpClient.post(
        '/social/vote',
        {
          value: voteValue,
          profileId: user.profileId,
          postId: post.id,
        },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      logger.log(`Added vote ${voteValue} to post ${post.id}`);
    } catch (err: any) {
      if (err.response?.status === 403) {
        votesEnabled = false;
        logger.warn(
          'Skipping remaining vote seed because local-hub users do not currently have vote permission.'
        );
        break;
      }
      logger.debug(`Could not vote on post ${post.id}: ${err.message}`);
    }
    await sleep(20);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  logger.log('=== Seed Complete ===');
  logger.log(`Users: ${authenticatedUsers.length}`);
  logger.log(`City community ID: ${cityCommId}`);
  logger.log(`Foodies community ID: ${foodieCommId ?? 'N/A'}`);
  logger.log(`Posts: ${allPosts.length}`);
  logger.log(`Comments: ${createdComments.length}`);
  logger.log('=== Test Credentials ===');
  for (const user of authenticatedUsers) {
    logger.log(`  ${user.email} – profileId: ${user.profileId}`);
  }
}

bootstrap().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
