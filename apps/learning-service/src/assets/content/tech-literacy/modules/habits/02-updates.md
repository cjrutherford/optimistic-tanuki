# Why "Later" Is a Decision

The update notification arrives at an inconvenient moment nearly every
time, because there is no convenient moment — you're in the middle of
something, the device needs to restart, and the button that says "remind
me later" is right there. Clicking it feels like deferring a small
inconvenience. It's worth understanding what it actually defers, so that
clicking it is a choice you're making rather than a reflex.

---

## What an Update Usually Contains

Software updates bundle several kinds of changes: new features, performance
improvements, and fixes for problems that have been found in the software
since the last version. A significant share of that last category —
sometimes the majority, for operating systems and widely used applications
— is fixes for security weaknesses: specific ways the software could be
made to do something it shouldn't, discovered either by the company that
makes it, by independent researchers, or occasionally by people actively
exploiting it before it was found.

The important detail is what "found" means here. Once a weakness has been
identified and a fix has been written, the details of that weakness often
become at least partially public — through the update's own release notes,
through security researchers publishing their findings, or through the fix
itself, which can sometimes be examined to work out what it was protecting
against. That means the update doesn't just fix the problem for people who
install it. It also, indirectly, informs people who study these things
about exactly what the weakness was — including people looking for
software that hasn't been updated yet, so they can use it.

---

## The Window That Matters

That creates a specific window of exposure: the gap between the point a
fix becomes available and the point you actually install it. Before the
fix existed, the weakness may have been unknown to almost everyone,
including people who might misuse it — a relatively low-probability
situation. After you install the fix, it's closed on your device. In
between those two points, the fix exists, its existence is at least
somewhat public, and your device doesn't have it yet. That window is
where a meaningful share of real-world exploitation actually happens,
because it's the period when the information needed to exploit the
weakness is available while a large number of devices are still
unprotected.

This is the concrete reason "later" is a decision rather than a neutral
default. Every day the update sits unapplied is a day inside that window,
on a device other people know has that specific gap in it, for however long
that particular software line stays that way.

---

## Why People Actually Postpone Them

None of this means the annoyance is imaginary. Updates interrupt what
you're doing. Restarts cost time. Occasionally an update introduces a new
problem — a feature that stops working the way you relied on it, an
interface that changes without warning. Those are real costs, and the
instinct to postpone isn't irrational; it's weighing an immediate, certain
inconvenience against a possible, delayed cost that's hard to picture.

A few things make that trade-off easier to manage without ignoring it
entirely. Most devices let you schedule updates for a specific time — late
at night, during a lunch break — so the interruption happens when you've
chosen it rather than when the notification happens to appear. Most also
separate "security fixes" from "major feature updates" to some degree,
where the former are smaller, install faster, and are less likely to change
how something looks or works, and updating them promptly captures most of
the benefit described above at a much lower cost. Waiting a day or two on a
major version update, to see whether other users report a serious problem,
is a reasonable middle ground for that category — waiting indefinitely is
not.

---

## What to Actually Do

The practical version of this lesson is not "update the instant every
notification appears." It's "don't let updates silently expire into never
happening." Turning on automatic updates where the option exists removes
the decision entirely for most routine fixes. Where automatic updates
aren't available or aren't appropriate, checking on a fixed schedule — the
next lesson gives you a monthly routine that includes this — turns "later"
from a habit of indefinite postponement into a bounded, known delay you've
actually chosen.

---

## Devices People Forget Are Software

The word "device" in this lesson doesn't only mean phones and computers.
A home router, a smart TV, a printer connected to your network, a doorbell
camera — all of these run software, and that software can have the same
kind of weaknesses covered above, with updates that close them the same
way. They tend to get forgotten precisely because they don't interrupt you
with a notification the way a phone does; many require you to actively
check a settings menu or a companion app to find out whether an update is
waiting. It's worth including whichever of these you own in whatever
routine you build, even if the process for checking looks different from
the one you use on your phone or computer.

---

## In Short

1. Updates mostly close gaps that are, to some degree, now publicly known to exist.
2. The window between a fix existing and you installing it is where real exploitation concentrates.
3. The annoyance of updating is real; scheduling updates for a convenient time addresses that without skipping them.
4. Prompt updates for security fixes matter more than promptness on feature updates.
5. Automatic updates, or a fixed check-in schedule, turn indefinite postponement into a bounded, chosen delay.
