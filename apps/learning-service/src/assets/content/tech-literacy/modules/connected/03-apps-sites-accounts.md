# Apps, Sites and Accounts

The same service can look and behave differently depending on whether you
reach it through a phone app, a website in a browser, or a television
interface — different layouts, different buttons, sometimes different
features entirely. This lesson is about why, and about the one thing that
stays constant underneath all three: your account.

---

## Three Doors, One Room

Think of the app, the site, and the TV interface as three separate doors into
the same building, rather than three separate buildings. Each door was built
for a different way of walking through it — a phone screen is small and
touched with a finger, a laptop screen is larger and used with a mouse and
keyboard, a television is viewed from across a room and controlled with a
handful of buttons on a remote. The company building the service designs a
different entrance for each of those situations, because a layout that works
well on one does not work well on another.

But once you are through any of those doors, you are in the same building:
the same server, described in the previous lesson, answering requests and
sending back the same underlying information. A show marked as watched on a
television app shows up as watched in the phone app too, not because the two
apps talked to each other directly, but because both of them asked the same
server, and the server holds one shared answer.

---

## The Account Is What Persists

The account is the actual thing you have with a service. It is a record, kept
on the server, of who you are to that service: your settings, your saved
items, your history, your payment details if you have provided them, and
credentials that let you prove it is you. The app on your phone and the
website in your browser are not where any of that lives — they are ways of
asking to see it and change it.

This is why signing in on a new device, one you have never used with that
service before, immediately shows your saved items and history: nothing was
transferred to the new device. The new device is simply making the same
kind of request to the same server that your old device always made, and the
server is returning the same account information it always held. The device
was never the thing storing your data in the first place, for any service
built this way.

Not every piece of software works like this. Some older or simpler
applications store information only on the one device they are installed on,
with no server involved and no account required. Those do not carry over to
a new device automatically, because there genuinely is nothing shared to
fetch — there is no account, in the sense used here, at all. Knowing which
kind of software you are using — account-backed or device-only — tells you
in advance whether switching devices will bring your information with it.

---

## Why Features Differ Between Doors

Companies do not always build every feature into every version of a service
at the same time. A feature might launch on the website first because it was
easier to build there, and arrive on the phone app months later, or never.
A television interface, controlled entirely by a remote with a handful of
buttons, often supports only a stripped-down set of actions compared to a
touchscreen or a keyboard, because some interactions are simply impractical
to perform with four directional buttons and a select button.

This means "the app is missing something the website has" is a real and
common situation, not a sign that something is broken. If a feature you rely
on is not where you expect it, checking whether it exists on a different
door into the same account is a reasonable next step before assuming it is
gone entirely.

---

## Signing In Is Proving, Not Creating

Signing in on a new door is the act of proving to the server that you are
the owner of a given account, usually by supplying credentials — most
commonly a username or email address paired with a password, sometimes
combined with a second proof, covered in a later lesson in this course. It
is not the act of creating anything new. The account already exists on the
server before you sign in anywhere; signing in just opens a door that was
already there.

This distinction matters when something goes wrong during sign-in. An error
at this stage is almost always either your credentials not matching what the
server has on record, or a temporary problem with the server itself
(discussed in the next lesson) — not a sign that your account or its
contents have been lost. The account's data sits on the server regardless of
whether any door into it is currently working.

---

## When the Doors Disagree

Occasionally the version of your account visible through one door lags
behind another — a change made on the website has not yet appeared in the
phone app, for instance. This usually happens because the app on your device
keeps a temporary local copy of some information, to avoid asking the server
to resend everything every single time you open it, and that local copy has
not yet been refreshed with the latest version from the server. Closing and
reopening the app, or waiting for it to periodically check in with the
server on its own schedule, usually resolves the mismatch, because both
doors are ultimately reading from the same source and will eventually agree.

---

## Best Practices

1. When a service behaves differently across devices, assume a design or feature difference between doors before assuming your account has changed.
2. Check whether software is account-backed or device-only before relying on it to carry information to a new device.
3. If a feature seems missing, check other doors into the same account before concluding it does not exist.
4. Treat sign-in problems as either a credentials mismatch or a server problem, not as evidence that your account or its data is gone.
