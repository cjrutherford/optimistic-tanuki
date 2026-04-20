# Bug Hunt 030426

## Objectives

1. remove follow button from client-interface feed => post component.
2. in the post component, make the user profile name and photo component a context menu with options to follow/block/view profile
3. we need to repurpose the /profile route to display a specific user's profile (for the view action in the dropdown to link to.)
4. viewing a profile that isn't the logged in user should show follow/unfollow/block/message/invite options.
5. veiwing a profile should include posts and communities the user is part of.
6. Community find page still does not successfully get community membership, which should already be in the community information already. we don't need to call the api for this. simply compare the currentUserId to the membership/ownership list in the community DTO, make sure it's included in the api call for the communities at the start.
7. the api call check mentioned in objective 6 is also causing a failure to load the community's page after joining. please fix in the same manner.
8. Remove lazy loading image support from the explore page. simply load the URL and don't try to recover.

## additional objectives.

1. **Map current UX and routing**

   - Locate `post` component in `client-interface` and identify:
     - existing follow button render path
     - profile avatar/name click handlers
   - Locate `/profile` route ownership and current assumptions (self-profile only vs dynamic profile).

2. **Post component behavior changes**

   - Remove inline follow button from feed post card UI.
   - Convert author avatar/name area into a context menu trigger with:
     - Follow/Unfollow
     - Block/Unblock
     - View Profile
     - Direct Message
     - Invite to community (popout select with owned/moderating commmunities)
   - Ensure menu actions use existing social relationship APIs and optimistic UI state.

3. **Route repurpose for profile viewing**

   - Refactor `/profile` to support `/:userId` (or equivalent canonical param).
   - Keep backward compatibility for self-profile route (redirect or default to logged-in user).
   - Update all profile links to use canonical route.

4. **Profile page conditional actions**

   - If viewing another user: show Follow/Unfollow, Block/Unblock, Message, Invite.
   - If viewing self: hide those actions and keep self-management controls.
   - Gate actions by auth and relationship state.

5. **Profile content completeness**

   - Add/verify sections for:
     - user’s posts
     - communities the user belongs to
   - Implement paginated loading with proper empty/error states.

6. **Hardening pass**
   - Add unit tests for:
     - post context menu visibility and action dispatch
     - profile route param handling
     - conditional action rendering (self vs other)
   - Add integration/e2e tests for:
     - “View Profile” from post menu
     - follow/block state transitions
   - Validate accessibility (keyboard menu navigation, aria roles), loading states, and API failure rollback.

## **Definition of done**

- Objectives 1–8 in Objectives section are met.
- Objectives 1-7 in additional objectives section are ment
- No regression in feed rendering or profile navigation.
- Tests pass via Nx (target affected projects), and manual smoke test on Linux dev stack succeeds.
- the command `pnpm run build:dev && pnpm run docker:build:dev && pnpm run docker:dev` completes successfully without issue.
