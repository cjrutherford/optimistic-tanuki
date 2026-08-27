# And What It Charges

The previous lesson listed what a boundary buys. None of it is free, and the
bill comes due in three specific ways every time a function call turns into
a network call. This lesson prices them, using the same gateway-to-learning
service boundary, so the trade is concrete rather than a warning to keep in
mind.

---

## A Call That Could Not Fail Becomes One That Can

Inside a process, calling a method on an object you are holding a reference
to essentially cannot fail on its own terms. It might throw because of a bug
in its logic, but it does not fail because the object stopped existing
between the call and the return. Once that call is `this.learningService.send(...)`
over TCP, awaited with `firstValueFrom`, an entire category of failure
appears that had no analog before: the socket can be down, the learning
service can be mid-restart, the request can time out.

Every route in `apps/gateway/src/controllers/learning/learning.controller.ts`
carries this cost, and most of them pay it by doing nothing special: an
unhandled rejection becomes a 500, which is a legitimate answer for routes
where there is no sensible partial result. `resolveAuthor` is the one route
that decided a 500 was too expensive for what it was protecting, and wrapped
the call in a `catch` that returns `null`. That decision is not free either.
It has to be made deliberately, route by route, because a boundary does not
make failure handling optional; it makes failure handling mandatory in a
place it previously did not need to exist at all.

---

## One Transaction Becomes Two, With No Rollback Across Them

A single process talking to one database can wrap several writes in one
transaction and get atomicity: either all of them commit or none do. The
moment the writes are split across two services, that guarantee is gone.
`createOffering` in the learning service's repository writes a program track
and an ownership row as one unit of work inside its own database, and that
still works, because both rows live behind the same boundary. But nothing
in this codebase attempts to make an offering creation atomic _with_ a call
across the gateway boundary to another service, because there is no
mechanism here that would make that safe. A two-phase commit protocol spanning
independently deployed services is a large amount of machinery this platform
does not build, for good reason: it reintroduces the coupling a boundary was
drawn to remove.

The honest response is not to pretend the two writes are atomic. It is to
decide, for each one, what happens if the first succeeds and the second
never does: whether the result is retried, reconciled later, or simply
tolerated as achievable but rare. A boundary asks you to answer that
question explicitly instead of getting the answer for free from a database
driver.

---

## Coordinated Deploys and a Mixed-Version Window

A contract between two services is a promise, and promises can be broken by
changing either side alone. If the learning service starts requiring a field
the gateway does not yet send, or renames a command the gateway still sends
under its old name, the two are now speaking different contracts, and the
window where that is true is not instantaneous. During a rolling deploy,
some gateway instances are running old code against a learning service
running new code, or the reverse, for as long as the rollout takes.

That window is exactly where a mismatch like the one in
`resolveAuthor` becomes dangerous rather than merely embarrassing: reading
`profile.name` when the field crossing the wire is `profileName` was a
contract violation that produced no error, just a name that was always
missing. A boundary makes a breaking change something that has to be planned
as two changes, an additive one deployed first and a removal deployed later
once nothing depends on the old shape, rather than one change landing
everywhere at once the way it would inside a single process.

---

## Weighing It

None of these costs is a reason to avoid boundaries. They are the reason to
draw fewer of them than the codebase's directory structure might suggest,
and to draw the ones you do draw where the benefits from the previous lesson
actually apply. A boundary that buys nothing but pays all three of these
costs is a boundary drawn in the wrong place, which is what the next lesson
is about.

1. Price a proposed boundary in these three currencies before drawing it:
   new failure modes, lost transactional atomicity, and deploy coordination.
2. Decide failure handling per call, deliberately, the way `resolveAuthor`
   does, rather than letting every crossing default to the same response.
3. Treat a contract change as two deploys, not one, whenever the two sides
   cannot be released atomically together.
