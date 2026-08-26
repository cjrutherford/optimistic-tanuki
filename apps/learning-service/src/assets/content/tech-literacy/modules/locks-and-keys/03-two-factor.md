# Two-Factor Authentication

A password, even a strong, unique one, is a single thing that proves you are
you: something you know. If that one thing is ever exposed — through a
breach at the service itself, through being tricked into typing it into a
fake page, through any means at all — it is the only barrier standing
between an attacker and your account. Two-factor authentication adds a
second, different kind of proof, so that a password alone is no longer
enough. This lesson explains what that second factor actually defeats, and
walks through the real differences between the three common forms it takes.

---

## What a Second Factor Defeats That a Password Cannot

The core idea behind two-factor authentication is combining two different
categories of proof: something you know, like a password, and something you
have, like a physical device or an app that can generate a one-time code.
Signing in then requires both. Knowing the password alone is no longer
sufficient, because the sign-in also demands proof from the second category,
and an attacker who obtained your password through a breach or a trick
generally has no access to the physical device or app tied to your account.

This directly addresses the reuse mechanism described earlier in this
module. Credential stuffing — trying a stolen email-and-password pair
against other services — depends entirely on the password being sufficient
by itself. A service protected by two-factor authentication stops that
attack cold: the correct password gets the attacker halfway, and the second
factor, which was never part of the stolen data, stops them there.

It is worth being precise about what this does not defend against. If
someone gains control of both factors — your password and the device or app
generating your codes — two-factor authentication offers no additional
protection, because both proofs have been compromised. It is a second lock,
not a different kind of lock immune to every attack; its value comes from
requiring an attacker to compromise two separate things instead of one.

---

## App Codes

An authenticator app, installed on your phone or another device, generates a
short numeric code that changes automatically every thirty seconds or so.
Setting it up links the app to your account through a one-time setup step;
after that, the app and the service both independently calculate the same
changing code using shared information exchanged during setup, without
needing to communicate with each other again. When you sign in, you read the
current code off the app and type it in.

Because the app calculates codes locally, using no network connection of its
own, this method does not depend on cellular signal, text messaging service,
or any connection at the moment you need the code — it works as long as the
device the app is installed on is with you and has power. It also is not
routed through any outside company at the moment of use, which removes a
category of interception risk described below.

---

## Text Message Codes

A text message code works by the service sending a one-time code to your
phone number via SMS, which you then enter to complete sign-in. This is the
most familiar form to most people, because it requires no separate app and
uses a phone number most people already have set up.

It is also, of the three methods covered here, the weakest, and the
mechanism is worth understanding rather than taking on faith. A text message
is delivered through the cellular network via your phone number, and phone
numbers can be transferred between devices — a legitimate feature that lets
you keep your number when you get a new phone or switch carriers. An
attacker who can convince a phone carrier's support process to transfer
your number to a device they control, a form of impersonation known as SIM
swapping, then receives your text message codes directly, on their device,
with no need to have ever touched your phone. This is a real, documented
attack, not a hypothetical one, and it is why text message codes, while
still meaningfully better than a password alone, are considered the
weakest of the three options here.

---

## Physical Security Keys

A physical security key is a small dedicated device, often connected via a
USB port or held near your phone using short-range wireless communication,
that proves your identity through a cryptographic exchange with the service
rather than by displaying a code you type in. Instead of reading a number
and entering it, you plug in or tap the key when prompted, and the key and
the service complete the proof directly between themselves.

Because there is no code displayed or typed, this method is not vulnerable
to being tricked into entering a valid code on a fake copy of a real sign-in
page — a technique called phishing, where an attacker sets up a page
designed to look identical to a genuine sign-in screen and captures whatever
you type into it, including a text message or app code that would otherwise
have worked. A security key checks, as part of its cryptographic exchange,
that it is talking to the genuine service, and simply does not respond to
the fake page's request at all. This makes it the strongest of the three
options against that particular attack, at the cost of needing to have the
physical key with you, and of losing access if the key itself is lost,
usually requiring a backup key or a recovery process set up in advance.

---

## Choosing Among Them

Any of the three is a substantial improvement over a password alone, and the
honest advice is to use whichever one you will actually keep using
consistently, rather than holding out for the theoretically strongest
option and using nothing in the meantime. Where a choice is available and
the account is one you would consider high-value — a password manager, a
primary email account, a bank — an authenticator app is a reasonable
default for most people, and a physical security key is worth the extra
step for the accounts you would least want compromised. Text message codes
remain far better than no second factor at all, even given their weakness
relative to the other two.

---

## Best Practices

1. Turn on two-factor authentication on any account that offers it, starting with your primary email and password manager.
2. Prefer an app code or physical key over a text message code where the choice is available.
3. Set up a backup method — a second key, or printed recovery codes — before you need one, in case your primary method is lost.
4. Do not treat two-factor authentication as protection against someone who has already gained control of both factors.
