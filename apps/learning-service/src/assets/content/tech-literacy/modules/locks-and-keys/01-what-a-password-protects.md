# What a Password Actually Protects

A password proves to a server, in the sense used in an earlier lesson, that
whoever is signing in is the person the account belongs to. That is the
entire job it does. Understanding exactly that scope — what a password
defends against, and just as importantly what it does not — is the point of
this lesson, and it sets up the single most important idea in this course:
reusing a password across services is the biggest risk covered anywhere in
this material, and it deserves to be understood mechanically, not just
avoided out of habit.

---

## What a Password Actually Defends Against

A password's job is narrow: it stops someone who does not know it from
signing in as you. That is a real and useful thing to defend against. Most
unwanted access to an account happens because someone else obtained a way to
sign in as the account's owner, not because they broke into a server through
some other means. A password that is hard to guess, and known only to you,
closes that door.

A password does not defend against several other things people sometimes
assume it does. It does nothing to protect data while it travels between
your device and a server — that protection comes from encryption in transit,
covered in an earlier lesson, and is present or absent independent of your
password's strength. It does nothing to stop the company running the service
from accessing your data on their own server, since your password only
gates the door you use — their own staff, subject to their own policies, use
different means of access entirely. And it does nothing to protect you if
the server itself is broken into and its stored data — including, depending
on how carelessly the company stored it, your password — is copied out
directly by an attacker who never had to guess anything.

---

## The Mechanism Behind Reuse Being Dangerous

Here is the part worth reading slowly, because the mechanism is what makes
reuse dangerous, not a vague sense that it is "bad practice."

Services occasionally suffer breaches — an attacker gains unauthorized
access to the company's servers and copies out stored account information,
sometimes including passwords, sometimes including your email address
paired with your password directly. This happens to companies with strong
security and companies with weak security alike; it is common enough that
assuming it has already happened to at least one service you have an account
with is a reasonable, not paranoid, starting point.

If you used the same password on a second, unrelated service, that breach is
no longer confined to the first service. An attacker who now holds your
email address and password from the breached service can simply try that
same pair on other popular services — a completely automated process, run
against millions of stolen credential pairs at once, called credential
stuffing. If your email and password match on a second service, the
attacker is in, and nothing about the second service's own security mattered
at all, because the door was opened with a key copied from somewhere else
entirely.

This is the whole mechanism. A breach at Service A becomes a successful
break-in at Service B, C, and D, purely because the same key opened all
four doors. The second, third, and fourth services did nothing wrong. Your
reused password is the entire cause.

---

## Why Length Matters More Than Complexity

For a long time, common advice pushed people toward complexity — a mandatory
mix of upper and lower case letters, numbers, and symbols — on the theory
that more character variety makes a password harder to guess. Current
guidance from security standards bodies has moved away from that emphasis.
Length matters more than enforced complexity: a longer password is harder to
guess through brute-force attempts regardless of whether it also contains a
symbol, and forcing complexity rules tends to push people toward predictable
patterns instead — a capital letter at the start, a number and a symbol
tacked onto the end — that are easier to guess than they look, precisely
because so many people, forced by the same rule, land on the same handful of
patterns.

The same guidance has also moved away from forcing periodic password
changes — the old advice to change every ninety days regardless of whether
anything happened. That practice, too, tended to produce predictable
patterns, as people cycled through minor variations of one password to
satisfy the requirement rather than to reflect any actual improvement in
security. A password should be changed when there is a specific reason to
believe it may have been exposed — your own or a breach at a service you use
— not on a fixed calendar with no such evidence.

---

## What Actually Makes a Password Strong

Given the above, a strong password is best understood as one with two
properties: it is long, and it is not reused anywhere else. A long,
memorable phrase you have not used for any other account defends well
against guessing, and — this is the part complexity rules never addressed —
defends completely against the credential-stuffing mechanism described
above, because a password unique to one service cannot be copied out of a
breach and reused against another.

The practical difficulty is obvious: remembering a distinct, long password
for every service you use is not realistic for most people beyond a small
handful of accounts. That difficulty, and a specific tool built to remove
it, is the subject of the next lesson.

---

## Best Practices

1. Do not reuse a password across services — this single habit closes off the most common way accounts actually get broken into.
2. Prioritize length over forced complexity when choosing a password.
3. Change a password when you have specific evidence it may be exposed, not on a fixed schedule.
4. Remember that a password protects only the sign-in door — it does not protect data in transit, and it does not limit what the service provider itself can access.
