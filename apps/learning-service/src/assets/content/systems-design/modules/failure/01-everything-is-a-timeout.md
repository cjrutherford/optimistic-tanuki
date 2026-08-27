# Every Call Is a Timeout Waiting to Happen

A function call inside one process cannot fail the way a network call fails. It runs, or the whole process is already gone and nothing you wrote is running either. There is no in-between state where the call is neither finished nor abandoned. The moment a call crosses a process boundary, that guarantee disappears, and a call that could not fail becomes one that can fail in a way your code has to name a policy for.

This lesson is about naming that policy honestly, before the other lessons in this module argue about what the policy should say.

---

## What Changes at the Boundary

Inside one process, a function returns, throws, or the process dies. Three outcomes, and the third one takes your code down with it, so from the caller's point of view there are really only two: it returned, or it threw.

Across a boundary (a network call, a queue, a call to another service) a fourth outcome appears that has no equivalent on one machine: the call can simply not come back. Not throw, not return, just never resolve, or resolve so late that resolving is no longer useful. The remote process might be slow. The network between you and it might be slow, or partitioned, or dropping packets it will never retransmit. The remote process might have already finished the work and be trying to tell you, on a connection that closed a second before its answer arrived.

None of that is possible for a plain function call. All of it is possible the instant the call leaves the process.

```typescript
// Same shape, different universe.
const a = addOne(x); // returns, or the process is dead
const b = await httpClient.get(url); // returns, throws, or never settles
```

The syntax looks identical. `await` makes a network call read like a function call, which is exactly the trap: it borrows the local call's grammar without inheriting its guarantee.

|           | Local call           | Remote call                                                    |
| --------- | -------------------- | -------------------------------------------------------------- |
| Outcome 1 | Returns              | Returns                                                        |
| Outcome 2 | Process dies with it | Throws                                                         |
| Outcome 3 | (not possible)       | Never comes back, and you find out nothing when it doesn't     |
| Outcome 4 | (not possible)       | Comes back too late to be useful, having already done the work |

Two outcomes on the left, four on the right. The two extra ones on the
right have no local equivalent at all: a plain function call cannot
silently never return while the rest of the process keeps running, and it
cannot finish its work and then fail to tell you. Both are ordinary for a
call that crosses a boundary.

---

## The Gateway's Answer: a Deadline

This workspace's gateway does not leave that fourth outcome open-ended. `RequestTimeoutInterceptor` applies a default to every route, so a call that would otherwise hang forever instead gives up on a schedule. `apps/gateway/src/decorators/request-timeout.decorator.ts` lets a route override that default with `@RequestTimeout`, `@LongRunning`, or `@ModelBound`, because not every boundary crossing has the same shape of slow.

Naming the timeout is the easy part. What the timeout means once it fires is not obvious at all, and getting that wrong is the subject of the next lesson: a fired timeout is not a report that the work failed. It is a report that the caller stopped waiting. Those are different facts, and code that treats them as the same fact produces the exact bug this workspace shipped and then fixed.

---

## Every Boundary, Not Just HTTP

It is tempting to read "boundary" as "network call to another service" and stop there. The gateway's own routes cross several boundaries in one request: gateway to learning-service over a message transport, learning-service to its database, and on the marking route, learning-service (or whatever it calls) to a language model. `apps/gateway/src/controllers/learning/learning.controller.ts` proxies almost every route through `firstValueFrom(this.learningService.send(...))`, and every one of those sends is a boundary crossing wearing the syntax of a function call.

A database query is a boundary too, even though it is easy to forget because most ORMs make it look like calling a method on an object. The database is a separate process, usually a separate machine, reachable over a network with its own failure modes. A query that takes an unusually long lock, or a database under load, produces the identical fourth outcome: not an answer, not an error, just silence past the point where silence stopped being informative.

The rule generalizes: any call that leaves the process is a call that might never come back, and code that doesn't decide what "might never come back" means has not actually decided how to handle it. It has just left the decision to whatever the default happens to be, which on this gateway is a 30-second global default, and on plenty of systems is nothing at all.

---

## Why This Matters Before Any of the Rest

Every later lesson in this module assumes you already believe the claim in this one: crossing a boundary changes the kind of thing a call is. Retries only make sense against a call that can fail without you finding out cleanly. Idempotency only matters because a call you can't confirm might get repeated. Budgets only need sizing because an unbounded wait is not actually an option once something else, a user, a caller, a queue, is waiting on you.

If the claim in this lesson doesn't land, the rest reads as a list of unrelated defensive habits. If it does land, they read as one consequence unfolding in different directions.

1. A local call has two outcomes: it returns, or the process died with it.
2. A remote call has a third: it might never come back, and you find out nothing when it doesn't.
3. Every boundary (HTTP, message transport, database, model inference) carries that third outcome, whether or not the syntax looks like a boundary.
4. Deciding what happens on that third outcome is not optional error handling. It is the actual design of the call.
