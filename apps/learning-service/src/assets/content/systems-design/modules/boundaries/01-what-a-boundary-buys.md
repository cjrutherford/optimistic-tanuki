# What a Boundary Buys You

A boundary is the line in a system where one process stops and asking
another process begins. Inside a process, "call this function" and "trust
this function ran" are the same statement. Across a boundary they split
apart, and that split is expensive enough that you should only pay for it
when it buys something. This lesson names what it buys, in terms of a
boundary this platform actually has: the gateway and the learning service,
talking over NestJS TCP through `ClientProxyFactory.create` in
`apps/gateway/src/app/gateway-service-providers.ts`.

---

## Independent Deploy

The gateway and the learning service are two processes. They can be built,
tested, and shipped on separate schedules, because nothing forces them to
move together. A fix to how the learning service merges lesson progress can
go out this afternoon without the gateway's release train, and a change to
how the gateway throttles requests can go out without redeploying the
learning service at all.

That is only true, though, because the two sides agreed on a contract and
neither one reaches past it. If the gateway imported the learning service's
repository classes directly, "independent deploy" would be a claim, not a
fact: a schema change in one would silently break the other at runtime, and
the two would need to ship together whether anyone admitted it or not. The
deploy independence a boundary buys is exactly as real as the discipline of
staying on the contract's near side of it.

---

## Hard Enforcement

Inside one process, nothing stops a function from reaching into a struct it
was handed and reading a field the author never meant to expose. The
language lets you; only convention says not to. Once a boundary is a network
call, that stops being optional. The learning service's internal
repositories, entities, and query builders are not reachable from the
gateway at all. The gateway can only send a command over TCP and get back
whatever the learning service chooses to serialize in response.

That is enforcement a code review cannot match. A reviewer can miss that a
new field leaked into a response DTO. A network boundary cannot be talked
past by an unusually determined caller reading source code, because there is
no source to reach into: there is a socket, and what crosses it. Boundaries
convert "please don't" into "you structurally cannot," which is the whole
value of drawing one where it matters.

---

## Separate Failure and Scaling Profiles

A function call inside one process fails when the process fails. Two
services across a boundary can fail independently: the learning service can
be down while the gateway, the profile service, and everything else keep
answering requests that do not need it. `resolveAuthor` in
`apps/gateway/src/controllers/learning/learning.controller.ts` leans on
exactly this. If the profile service is unreachable, the course page still
renders; only the author's name is missing. That degradation is only
possible because the two services' failures are not one failure.

The same separation applies to load. Grading a written answer against a
rubric occupies a language model and is throttled far tighter than running
code, which a learner might legitimately retry many times while chasing a
compiler error. Splitting these into a boundary means one traffic pattern
does not have to share a scaling plan with the other. A monolith can approximate
this with internal rate limits, but a real process boundary is where scaling
one part without the other stops being an approximation.

---

## What This Is Not Yet

None of this says boundaries are free, or that more of them is better. It
says what a correctly drawn one buys: independent releases, enforcement a
reviewer cannot bypass, and failure or scaling profiles that do not have to
match. The next lesson prices what the same boundary costs, and the two have
to be weighed against each other every time a new one is proposed.

1. A boundary is worth having when independent deploy, hard enforcement, or
   separate failure/scaling profiles are things you actually need, not
   things that sound good in the abstract.
2. The enforcement is only as real as the discipline of not reaching past
   the interface, in either direction.
3. Degrading gracefully, like `resolveAuthor` does, is a benefit you only
   get once the failure is genuinely separate.
