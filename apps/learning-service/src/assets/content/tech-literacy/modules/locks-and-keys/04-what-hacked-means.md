# What "I Got Hacked" Usually Means

"I got hacked" tends to conjure an image of someone specifically targeting
you — studying your habits, working to break into your particular accounts.
That happens, but it is rare, and it is not what most people mean when they
say it. This lesson explains what almost always actually happened instead,
and then lays out what to do about it, in order, because the order matters
as much as the individual steps.

---

## What Usually Actually Happened

Walk back through this module: services occasionally get breached, and an
attacker copies out stored account data, sometimes including passwords.
That breach gets compiled, often alongside dozens of other breaches, into a
large list of email-and-password pairs, which then gets tried automatically,
at enormous scale, against many other popular services — the credential
stuffing process described earlier in this module. None of this involves a
person choosing you specifically. It involves your credentials being one
entry among millions in a list, tried everywhere, succeeding wherever a
password was reused.

This distinction matters because it changes what response actually makes
sense. A targeted attack against you specifically would call for different,
more individualized precautions. An automated attempt using a password
leaked from some unrelated service you signed up for years ago calls for
something more specific and more fixable: finding and closing the actual
door that was used, which in the overwhelming majority of cases is a reused
password, sometimes combined with the absence of a second factor that would
have stopped the attacker even with the correct password in hand.

It is also worth naming, briefly, the other common route in: a phishing
page, mentioned in the previous lesson, that looks identical to a real
sign-in screen and simply asks you to type your password (and, if you have
it, your one-time code) directly into it. This is not a mysterious technical
break-in either — it is a convincing fake asking you to hand over the key
voluntarily. Both routes end the same way, with someone else now able to
sign in as you, and the response below applies to both.

---

## What to Actually Do, in Order

### First: Regain Control of the Account

If you can still sign in, change the password immediately, choosing a new
one that is long and not used anywhere else, following the reasoning from
earlier in this module. If you cannot sign in because the password has
already been changed by whoever accessed the account, use the service's
account recovery process — usually reachable through a "forgot password" or
"account compromised" option — which typically verifies your identity
through a linked email address or phone number and lets you reset access
even without the current password.

Regaining control comes first, ahead of every other step, because
everything else — reviewing what happened, protecting other accounts —
depends on the account being back under your control rather than someone
else's.

### Second: Check for a Reused Password Elsewhere

Once the immediate account is secured, the more urgent question is whether
the same password was used anywhere else, because if it was, those accounts
are exposed by the identical mechanism right now, whether or not they have
been accessed yet. Go through any other account that used the same or a
similar password and change it, prioritizing anything sensitive: a primary
email account, financial services, anything that itself can be used to
reset passwords elsewhere. A primary email deserves particular urgency,
because it is frequently the recovery method for everything else — someone
who controls it can often reset the passwords on other accounts by
requesting a reset email be sent there.

### Third: Turn On a Second Factor

If the account did not already have two-factor authentication enabled, turn
it on now, using an app or physical key where the service supports it,
following the previous lesson. This closes the specific door that was used
and makes a repeat attempt, even with a correct password obtained some other
way in the future, insufficient on its own.

### Fourth: Review What the Account Can Reach

Once the account itself is secure, check what it was connected to or capable
of while it was accessible to someone else: sent messages you did not send,
changes to recovery information (an attacker sometimes adds their own
recovery email or phone number to maintain access even after a password
change, which is worth specifically checking for and removing), financial
activity if the account is financial, or connected services and apps that
were granted access and should be reviewed for anything unfamiliar.

### Fifth: Consider a Password Manager, If You Have Not Already

If this happened because a password was reused, the underlying cause was
the reuse itself, not any single weak password. A password manager, covered
earlier in this module, removes the underlying cause going forward by
making unique passwords for every account the default rather than something
that requires ongoing manual effort.

---

## What Not to Spend Time On

It is rarely useful to try to identify who specifically accessed the
account. In the credential-stuffing scenario that accounts for most of
these incidents, the access was automated, run against a purchased or
leaked list, with no individual person deliberately choosing you — there is
usually nothing to trace and no one to identify. Time is better spent
working through the steps above than investigating an attacker who, in the
typical case, does not exist as a specific individual with a specific
interest in you.

---

## Best Practices

1. Regain control of the affected account before doing anything else.
2. Immediately change any reused password on other accounts, starting with your primary email.
3. Turn on two-factor authentication on the affected account and, ideally, everywhere else it is available.
4. Check for attacker-added recovery information before considering the account fully secured.
5. Treat the incident as a reused-password problem to fix at the root, not an isolated event to move past.
