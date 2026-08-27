# A Timeout Is a Budget, Not a Guess

Every earlier lesson in this module treated the timeout as a fixed fact: the gateway waits some number of seconds, then gives up. This lesson is about where that number should come from, and the honest answer is that most timeouts in most systems come from nowhere at all. Someone typed a round number that felt generous, shipped it, and it sat there until it was wrong for a specific route in a way nobody had measured.

A timeout is a budget: a claim about how long real work legitimately takes, backed by a number. Treated as a guess, it either wastes a caller's patience on work that finishes fast, or, as this workspace found out, cuts off work that was never given a fair chance to finish.

---

## The Number Has to Come From the Slow Path

`apps/gateway/src/decorators/request-timeout.decorator.ts` documents exactly how the model-bound timeout on this platform was sized, and it's worth reading as a template for the whole discipline:

> Sized from measurement, not taste: against a local 4b model, resume parsing took 102s, intro analysis 63s, and full topic analysis 164-332s. The 120s LONG_RUNNING_REQUEST_TIMEOUT_MS preset cut all of those off, which looks to the user exactly like the feature being broken.

Notice what didn't happen here. Nobody picked 600 seconds because it sounded safely large. Somebody ran the slow path, on realistic hardware, and wrote down what it actually took: 102 seconds for one kind of request, up to 332 for another. The 10-minute `MODEL_BOUND_REQUEST_TIMEOUT_MS` budget is generous room around that measured range, not a number invented to feel comfortable. "Generous room around a measured number" and "a round number that felt generous" produce similar-looking constants and completely different levels of confidence in them.

The comment on `answerActivity` in `apps/gateway/src/controllers/learning/learning.controller.ts` names the cost of skipping this step directly: the route was model-bound and used the gateway's ordinary 30-second default, which was never sized for grading at all. It was sized for ordinary request/response work, applied by default to a route that had nothing ordinary about it, and the result was exactly the failure lesson two in this module walks through: real, successful grading, reported to the learner as broken.

---

## The Fix Was a Budget, Not a Bigger Default

The tempting fix, once you've seen a slow route blow through the default, is to raise the default itself. Don't. The short default earns its keep precisely by staying short: it's what catches an accidentally slow query, a forgotten `await`, a route that quietly started calling something it shouldn't, before that becomes a production habit nobody notices. Raise the default to cover the slowest route in the system and every other route loses that early warning, waiting patiently on failures it should have been catching in thirty seconds.

The actual fix in this workspace was a per-route override: `@ModelBound()`, applied only to the routes whose latency is genuinely set by an inference server rather than by a bug. Everything else keeps the tight default, and the one route that legitimately needs ten minutes gets ten minutes, named on the route itself so the exception is visible in the code rather than buried in a global config value nobody remembers changing.

```typescript
// The default stays tight, on purpose. This route opts out explicitly,
// with the reason documented at the decorator, not silently at a config file.
@ModelBound()
@Post('activities/:activityId/answer')
async answerActivity(...) { ... }
```

A budget that applies everywhere equally isn't really a budget, it's an average, and averages hide exactly the routes that most need a real number.

---

## Bounded, Not Unbounded

It would have been simpler to remove the timeout from the marking route entirely: no deadline, wait as long as it takes. This workspace deliberately didn't do that. The same decorator's documentation explains why: ten minutes "leaves room for a cold model load on modest hardware, while still guaranteeing that a hung model eventually releases the connection — an uncapped route never does, which is fine for a debugging session and not fine in production."

That's the distinction a budget captures and an unbounded wait can't: a budget still ends. A model that has genuinely hung, rather than merely running long, will eventually exceed even a generous ten-minute allowance, and the connection gets released instead of held forever by a request that was never coming back. Removing the timeout doesn't fix the sizing problem, it just trades "times out too early" for "never notices when something is actually stuck," which is a worse failure to have in production because nothing ever surfaces it.

---

## Sizing a Budget for a Route You Haven't Measured Yet

The template generalizes past this one feature:

- Run the slow path for real, on hardware close to what production uses, and record the actual range, not a single lucky run.
- Set the budget above the top of that measured range, generously, but not unboundedly: the budget should still end.
- Keep the tight default for everything else. A per-route exception, named and documented at the route, is the right shape; a raised global default is the wrong one.
- Revisit the number when the underlying work changes. A number measured against one model, one dataset size, or one query plan stops being a budget and goes back to being a guess the moment the thing it was measuring changes underneath it.

1. A timeout is only a budget if it comes from measuring the slow path; otherwise it's a guess wearing a number.
2. This workspace's model-bound timeout is documented as measured against real runs: 102 to 332 seconds across three kinds of request.
3. The fix for a route that's legitimately slow is a per-route budget, not a longer global default; the short default's value is catching everything else.
4. A budget still ends. An unbounded wait trades an early, wrong failure for a late one that never surfaces at all.
