# Authorization Is Not a Middleware

Authentication and authorization get bundled together so often, in the same guard, in the same paragraph, in the same "auth" folder name, that it's easy to treat them as one concept with two names. They are not. Authentication answers "are you signed in, and who does the system believe you are." Authorization answers a completely different question: "may you do this, to this specific thing." The first question can be answered by a piece of middleware that never looks past the request headers. The second one cannot, because it needs the thing.

This lesson is about why that difference is architectural, not stylistic, and why code that tries to answer authorization in a middleware layer keeps quietly getting it wrong.

---

## What a Middleware Actually Has Access To

A middleware, or a guard in Nest's terms, runs before a route handler, and it typically runs before the handler has loaded anything. It has the request: headers, a session token, a body. From that, `AuthGuard` can answer "is there a valid session, and whose is it." That's authentication, and it's a question a middleware is well suited to answer, because everything it needs is already sitting on the request.

Authorization needs more. "May this profile update this offering" cannot be answered from the request alone, because the request doesn't say who owns the offering, whether this caller co-edits it, or whether the offering is even in a state where editing makes sense. That information lives in a database row the middleware has never seen. A middleware that tries to answer this question anyway either has to fetch the thing itself, at which point it has stopped being a lightweight gate and started being business logic wearing a middleware's clothes, or it skips the check and answers the authentication question only, leaving the real question unanswered.

---

## What This Workspace Actually Does

`apps/gateway/src/controllers/learning/learning.controller.ts` keeps the two concerns visibly separate, and it's worth reading the shape of `updateOffering` for exactly this reason:

```typescript
@UseGuards(AuthGuard)
@Put('offerings/:offeringId')
async updateOffering(
  @Param('offeringId') offeringId: string,
  @Body() body: { /* ... */ },
  @Req() req: { user: { userId: string; profileId?: string } }
) {
  const profileId = await this.learningProfiles.resolveProfileId(req.user.userId);
  const allowed = await this.offeringAuthorization.authorize(
    profileId,
    req.user.profileId,
    'update',
    offeringId
  );
  if (!allowed) {
    throw new ForbiddenException(
      'You may only update an offering you own or co-edit.'
    );
  }
  // ...
}
```

`AuthGuard` runs first and answers exactly one question: is this a real, signed-in caller. Everything past that line is a second, independent check, `offeringAuthorization.authorize`, that loads the offering, checks who owns it and who co-edits it, and only then decides. It takes an action name (`'update'`) and the specific offering's id, because "may you do this" is meaningless without naming the this and the this-to-what. That second check cannot live in a guard that fires before the handler even knows which offering is being asked about, because at that point in the request lifecycle the offering doesn't exist as far as the code is concerned yet, only its id does.

---

## Identity Is Also a Design Input, Not Just a Gate

The same controller shows a related point: even the parts that look like plain authentication are doing more than "signed in, yes or no." `IdentityThrottlerGuard`, used on the code-running and grading routes, overrides `getTracker` so rate limits key on `user:<userId>` when a caller is authenticated, falling back to the request's IP address only when they aren't. Its own comment explains the reasoning: an office or classroom behind one shared address should not share one rate-limit allowance, and a caller who switches networks should not get a fresh one by doing so.

That's a guard, correctly, because "how much has this identity already spent" is answerable from the request and a shared counter, no fetch of a specific resource required. But notice it's already more than a yes/no gate: it's a design decision about what identity means for this platform, encoded at the layer that runs before the handler. The lesson generalizes past this one guard: some questions genuinely belong at the front door (who is this, how much have they used), and some questions cannot be answered until you've loaded the specific thing they're asking about. Confusing the two, treating "may you do this" as if it were front-door work, is how a route ends up "protected" by a guard that never actually checked the one thing that mattered.

---

## The Test to Apply

When you're deciding whether a check belongs in a guard or in the handler, ask one question: does answering this require loading a specific record, or does it only need the request itself? If it only needs the request (is there a session, has this identity exceeded its rate limit), a guard is the right place. If it needs a specific thing, an offering, an activity, an attempt, to weigh who owns it, who's enrolled in it, or what state it's in, that check belongs after the thing is loaded, expressed as its own step, not folded into a guard that runs too early to have it.

1. Authentication answers "who is this." Authorization answers "may they do this, to this specific thing," and the second question needs the thing.
2. A guard that runs before the handler cannot answer a question that depends on a record the handler hasn't loaded yet.
3. This workspace keeps them separate on purpose: `AuthGuard` gates identity, `offeringAuthorization.authorize` loads the offering and decides, and the two are not interchangeable.
4. Some identity-shaped questions do belong at the guard layer, like rate limiting; the test is whether the question needs a specific resource loaded to answer it.
