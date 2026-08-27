# Test Doubles Drift From What They Double

A test double, a mock or a fake standing in for a real dependency, is only
useful to the extent that it behaves like the thing it's standing in for.
The moment it stops matching, and nothing forces it to keep matching, you
get a specific and quiet failure mode: the double and the code under test
were written by the same person, in the same sitting, against the same
mistaken idea of what the real dependency offers. They agree with each
other perfectly. They are both wrong, in the same direction, and a suite
built on that agreement has no way to notice.

---

## What Happened

A component was written against a couple of service methods,
`data.programs()` and `auth.person`, that sounded exactly like the kind of
thing those services should expose. The person writing the component
believed those methods existed. When it came time to write the test double
standing in for those services, the same person wrote a double with
`programs()` and `person` on it, because that's what the component called.

Every test passed. Of course they did: the double had precisely the shape
the component expected, because the double was written by reading the
component, not by reading the real service.

```typescript
// the double, shaped to match the component's assumptions
const fakeData = {
  programs: () => mockPrograms,
};
const fakeAuth = {
  person: mockPerson,
};

// the real service had neither of these
```

The real services did not have a `programs()` method or a `person`
property. Nothing in the test suite could have caught that, because
nothing in the test suite ever put the component in front of the real
service. The double and the component were checking each other's
homework, and they'd copied off each other.

---

## Why the Suite Can't See This From Inside

A unit test with a double is, structurally, a test of one claim: "given
this input, this component produces this output." The double supplies the
input. If the double's shape is wrong, that's not a fact the test can
discover, because the test's job is to check the component against the
double, not the double against reality. The double is playing double duty,
as the test's fixture and as the spec for what the real dependency is
allowed to look like, and only one of those jobs is actually being
checked.

```text
component  ◀──calls──  double
   │                       │
   │  written by the same person, from the same (wrong) mental model
   │                       │
   └──────── agree with each other, both wrong about the real service ────────┘
```

This is not a case where the component's logic was wrong. Its logic was
fine, given the interface it believed it had. The bug lived entirely at
the seam between the component's assumption and the real service's actual
shape, and a unit-level test, by construction, never crosses that seam.

---

## Why the Same Person Writing Both Sides Is the Actual Cause

It's tempting to describe this as a communication problem: the person
writing the component and the person maintaining the real service should
have talked. That's not quite what happened here, and naming it more
precisely matters. One person wrote the component, formed a belief about
what the services expose, and then wrote the double to match that same
belief, in the same sitting, from the same mental model. There was no
handoff where a second person's independent knowledge could have caught
the mismatch. The double wasn't drifting away from an original, accurate
baseline over time; it was wrong from the moment it was written, in
lockstep with the code it was standing in for.

This is why "keep the doubles in sync with the real service" isn't, by
itself, a sufficient instruction. Sync implies there's a baseline to sync
against, checked by someone or something outside the pair that might
share the same blind spot. Without that outside check, a double and its
component can stay perfectly, silently in sync with each other while both
drifting further from the real dependency, and every test written against
them will keep agreeing.

---

## How It Was Actually Found, and Fixed

A real production build, not a test, is what caught it: the real service
was called, `programs` and `person` weren't there, and it failed in a way
no test in the suite had. That's the subject of the next lesson,
`knowing/03-run-the-real-thing.md`: some classes of bug only exist at the
boundary between what code assumes and what the running system actually
provides, and a test suite built entirely from doubles never touches that
boundary.

The fix that followed wasn't just correcting the component. A test was
added asserting that the doubles' shape matches the real services' shape,
so a double claiming a method the service doesn't have fails immediately,
rather than agreeing with a component that shares its mistake.

1. A double is a claim about the real dependency's interface; if nothing
   checks that claim, the double can be wrong indefinitely.
2. Doubles and the code under test agreeing with each other is not
   evidence they're both right. It can just as easily mean they share an
   author's mistaken assumption.
3. Somewhere in the suite, something has to touch the real dependency, or
   assert that the double's shape matches it, or the seam between
   assumption and reality is untested by construction.
