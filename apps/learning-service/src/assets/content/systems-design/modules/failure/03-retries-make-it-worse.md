# When Retrying Makes It Worse

Retrying a failed call is the most natural instinct in distributed systems, and it is correct often enough that people stop examining when it isn't. The previous lesson established that a timeout doesn't tell you whether the work failed, is still running, or already succeeded. Retrying without asking which of those three is true is not a safety net. It is a second, independent action, taken blind, on top of a first action whose outcome you never actually learned.

This lesson is about the three ways that goes wrong: storms, herds, and repeating a write that was never safe to repeat.

---

## The Retry Storm

One caller retrying a slow downstream call is a minor cost. A thousand callers retrying the same slow downstream call at once is a second outage caused entirely by the first one.

Picture a service that's running a little slow under load, close to its capacity but still serving requests, just late. Every caller waiting on it times out around the same time, because they all issued their requests around the same time and share roughly the same deadline. Every one of them retries immediately, because immediate retry is the simplest thing to write. The struggling service, which was slow but coping, now receives a second wave of requests stacked on top of whatever it hadn't finished from the first wave. It falls further behind. More requests time out. They retry again.

This is not a hypothetical shape, it is the standard failure mode of naive retry logic, and it turns "one service is briefly slow" into "one service is now down," entirely through the good intentions of every caller trying to be resilient.

## The Thundering Herd

A related shape shows up without any retries at all: many callers, coordinated by nothing but a shared trigger, all act at the same instant. A cache entry expires and every request that would have hit the cache instead hits the origin at once. A scheduled job runs on the hour and every instance of it wakes up on the same tick. The load isn't the problem; the load's total lack of spread is. The same amount of work, arriving smoothly over a few seconds instead of arriving in one spike, would have been fine.

Retry storms and thundering herds are the same underlying mistake in two different triggers: many independent actors, no coordination, all converging on the same moment.

---

## Backoff and Jitter, Honestly

The standard fix is exponential backoff with jitter: each retry waits longer than the last, and the wait is randomized rather than fixed, so callers that started in sync drift apart instead of retrying in lockstep.

Be precise about what this buys you. It reduces the odds that every caller's retry lands in the same instant. It does not guarantee they won't; with enough callers, some will still collide by chance, and a bad enough underlying incident can still produce a pile-up even with jitter doing its job. Backoff and jitter turn a near-certain synchronized storm into a much smaller, spread-out one. They are not a proof that the storm can't happen, they are a way of making it survivable statistically, and a system that depends on them being a hard guarantee is depending on more than the technique provides.

```typescript
function backoffMs(attempt: number, base = 200, cap = 10_000): number {
  const exp = Math.min(cap, base * 2 ** attempt);
  // Full jitter: anywhere from 0 up to the exponential ceiling, so retries
  // spread out instead of landing on the same schedule.
  return Math.random() * exp;
}
```

This code makes collisions less likely. It does not make them impossible, and any capacity plan that assumes it does is planning against a guarantee that was never made.

---

## Retrying a Write Is a Different Kind of Danger

Everything above is about load. There is a second, sharper danger that has nothing to do with load at all: retrying a call whose first attempt might have already taken effect.

If a call only reads, retrying it is free; asking twice costs time, not correctness. If a call writes, and the first attempt's outcome is genuinely unknown (the exact situation the previous lesson describes), then a retry is not "trying again." It is potentially doing the same write twice, and whether that's safe depends entirely on what the write does. "Charge the card" done twice is two charges. "Send the confirmation email" done twice is two emails. "Increment the counter" done twice is a wrong counter. None of these are made safe by backoff, by jitter, or by careful scheduling, because the danger isn't timing, it's repetition itself.

This is exactly the shape this workspace closed off with `IdentityThrottlerGuard` and the grading throttle on `apps/gateway/src/controllers/learning/learning.controller.ts`: `GRADING_THROTTLE` caps a caller at 20 grading calls per window specifically because each one occupies a language model and a retried grading call is real, repeated work, not a free do-over. The guard limits how much any one identity can throw at the expensive routes; it does not, by itself, make repeating a submission safe. That's a separate property, and it's the entire subject of the next lesson.

---

## What to Actually Decide, Per Call

Before wiring a retry onto any call, answer two questions honestly:

- Is this call safe to repeat if the first attempt already succeeded? If you don't know, treat the answer as no until you've made it idempotent (next lesson).
- If many callers retry this at once, does the receiving end survive that, or does the retry become the outage? If it doesn't survive, back off with jitter, and still plan for the collisions jitter doesn't prevent.

1. A retry taken without knowing the first attempt's outcome is a second action, not a safety net.
2. Retry storms and thundering herds both come from many independent actors converging on one moment; jitter spreads that moment out, it does not remove it.
3. Backoff and jitter reduce collisions. They do not eliminate them, and treating them as a guarantee is a planning mistake.
4. Retrying a write is only safe when repetition itself is safe, which is a property you have to design, not one a retry library gives you for free.
