# The Edge Is the Contract

Inside a process, a type checker reads both ends of a call at once: the
caller and the callee are compiled together, so a field rename anywhere is
caught everywhere it is used. Across a boundary, that stops being true. The
gateway's TypeScript types for what the learning service or the profile
service sends back are, at best, a description someone wrote of what
crosses the wire. What actually crosses the wire is serialized data, and the
data is the contract, whatever the types on either side claim about it.

---

## A Bug That Proves It

`resolveAuthor`, in `apps/gateway/src/controllers/learning/learning.controller.ts`,
asks the profile service for the owner of a course and reads the field it
gets back:

```ts
const profile = (await firstValueFrom(this.profileClient.send({ cmd: ProfileCommands.Get }, { id: ownerProfileId, query: {} }))) as { id?: string; profileName?: string } | null;
```

An earlier version of this same code read `profile.name`. The type
annotation on the response can say whatever the author believes; TypeScript
will happily let a cast declare a shape that has nothing to do with what the
other service actually sends. The profile service's real field is
`profileName`, not `name`, so `profile.name` was `undefined` on every call,
forever. The response was still valid data by every check the language
performs: an object, optionally missing a property that was never going to
be there in the first place. Nothing threw. Every course simply reported
that its author was not recorded, silently, until someone read the profile
service's actual response shape and noticed.

---

## Why the Type Checker Cannot Save You Here

A type checker verifies that code is internally consistent with the types
it declares. It has no way to verify that those declared types describe
what a separate, independently deployed process actually returns, because
that process is not part of the same compilation. The cast in the snippet
above (`as { id?: string; profileName?: string } | null`) is not a claim
the compiler checks against reality; it is a claim the author makes about
reality, and `.name` versus `.profileName` shows what happens when that
claim is wrong. The compiler enforced perfect internal consistency around a
false premise.

This is not a criticism of casts, or of TypeScript, or of this codebase in
particular. It is what every boundary looks like from the inside: the wire
format is ground truth, and any type sitting on top of it is a description
that can drift from that truth without a single compiler error, because
nothing forces the description to be re-checked against the thing it
describes.

---

## What Actually Catches This

Three things narrow the gap, none of them a type checker alone:

**Shared schemas that both sides import**, like the Zod schemas in
`@optimistic-tanuki/learning-domain` (`PublicationStatusSchema`,
`isLessonNotFound`, and friends), which parse a response at runtime rather
than merely casting it. A `safeParse` failure is loud; a bad cast is silent.
Where a boundary crosses into truly untrusted territory, parsing the shape
on arrival is the difference between finding out immediately and finding
out from a user report.

**Reading the other side's actual code**, not just its published types,
before trusting a field name. The type the gateway declares for a profile is
the gateway author's belief, not the profile service's commitment. When the
belief and the commitment can drift independently, checking the source of
truth is the only way to know which one is current.

**Treating "no error" as weak evidence**, especially for optional fields.
`profile?.profileName?.trim()` returning an empty string and `profile?.name`
returning `undefined` produce the same downstream behavior: a missing
author. A field that is silently absent instead of throwing is exactly
where a contract mismatch hides longest.

---

## The Rule

What crosses the boundary is the contract. The types on either side are
notes taken about that contract, useful and usually accurate, but not the
thing itself, and not verified against the thing itself unless something
explicitly does that verification. When a boundary bug is silent rather than
a crash, the type checker is not the tool that will find it: reading the
actual payload is.

1. Treat the serialized data crossing a boundary as ground truth, and any
   local type describing it as an unverified claim.
2. Reach for runtime parsing (a schema, a validator) at boundaries where
   being wrong silently is worse than failing loudly.
3. When a value is unexpectedly missing across a boundary, check the field
   name against the other service's actual code before checking anything
   else.
