# Four Messages, Decided Out Loud

The previous lessons in this module covered pressure techniques, sender
verification, and channel-specific patterns separately. This lesson puts them
together against four realistic messages: two legitimate, two scams. Each is
presented in full, followed by a decision made out loud, naming the specific,
checkable evidence behind it rather than a general impression.

The four are not labelled in advance. Work through the evidence in each one
before reading the verdict, if you want to test yourself against the same
signals covered in this lesson.

---

## Message One

> From: Riverstone Credit Union <alerts@riverstonecu.com>
> Subject: Your monthly statement is ready
>
> Hello,
>
> Your account statement for the period ending August 15 is now available in
> online banking. Log in through the usual banking site or app to view it.
>
> If you have questions about your statement, contact us using the number on
> the back of your card.
>
> Riverstone Credit Union

### Deciding

The sender address, `alerts@riverstonecu.com`, matches the domain
`riverstonecu.com` — checkable, in a real situation, against a domain printed
on a card or a previous paper statement. There is no link in the message at
all; it directs you to log in "through the usual banking site or app," which
means there is nothing to hover over, nothing to compare, and no destination
to be misled by. There is no deadline, no threatened consequence, and no
request for a password, account number, or any other credential — the
message only states that something is available to view, through channels
you would reach on your own. This combination — a matching domain, no
embedded link, no urgency, no request for sensitive information — is
consistent with a legitimate notification. Verdict: legitimate.

---

## Message Two

> From: "Package Delivery" <notice@parcel-trackr-delivery.com>
> Subject: Delivery attempt failed — action required within 24 hours
>
> We attempted to deliver your package today but were unable to complete
> delivery. Your package will be returned to sender if not rescheduled within
> 24 hours.
>
> Reschedule your delivery now: [Click here to reschedule]
> (links to: http://parcel-trackr-delivery-update.net/reschedule)
>
> A small redelivery fee of $2.99 may apply.

### Deciding

Several signals stack here. The display name, "Package Delivery," names no
actual courier — a real delivery company identifies itself by name, not by a
generic description of its service. The sender's domain,
`parcel-trackr-delivery.com`, does not match any specific, known courier
either, which matters because a genuine delivery notice comes from the
courier that is actually handling the package, not an unnamed intermediary.
The link's visible text reads "Click here to reschedule," but its actual
destination is a different domain again —
`parcel-trackr-delivery-update.net` — a mismatch between what the link says
and where it leads, and a second, distinct domain from the one the message
was sent from. On top of the sender and link issues, the message carries a
24-hour deadline and a threatened consequence — the package being returned —
plus a small fee, an amount deliberately chosen to be easy to dismiss as not
worth questioning. Verdict: scam. Reschedule notices from real couriers name
the courier and link to that courier's own known domain, not a domain that
differs between the sender address and the link destination.

---

## Message Three

> From: "IT Support" <support@yourcompany-secure-portal.com>
> Subject: URGENT: Your account will be locked in 2 hours
>
> Your company email account has exceeded its storage limit and unusual
> sign-in activity has been detected. To avoid your account being locked,
> verify your identity immediately by signing in here:
>
> [Verify My Account]
> (links to: http://yourcompany-secure-portal.com/verify)
>
> This must be completed within 2 hours to prevent permanent suspension.

### Deciding

The display name "IT Support" borrows the authority of an internal
department without identifying a specific company by its real name — a
genuine internal notice from an employer's IT department is sent from that
employer's actual domain, not a separately registered domain with "secure
portal" appended to a company name. The sender's domain,
`yourcompany-secure-portal.com`, is exactly this kind of constructed domain:
a real-sounding phrase attached to words designed to sound official, rather
than the employer's own known domain. The link destination matches the
sender's domain in this case, which shows that a consistent link is not
sufficient on its own — the domain itself is the part that must be checked
against something already known to be correct, and here it fails that check
regardless of internal consistency. The message also combines two separate
claims, a storage limit and suspicious sign-in activity, into a single
2-hour deadline, and asks you to sign in through a link rather than through
the employer's own known sign-in page. Verdict: scam. A constructed,
unfamiliar domain, paired with a short deadline and a sign-in request routed
through a link instead of a known page, matches the pattern from earlier
lessons in this module even though the link and sender happen to agree with
each other.

---

## Message Four

> From: Public Library — Central Branch <noreply@centralbranch-library.org>
> Subject: Your reserved item is ready for pickup
>
> Hello,
>
> The item you placed on hold, "The Practice of System and Network
> Administration," is now ready for pickup at the Central Branch circulation
> desk. Please bring your library card.
>
> This hold will be kept for 7 days. After that, it will be returned to the
> general collection and you will need to place a new hold if you still want
> it.
>
> Questions? Call the circulation desk at the number listed on our website.

### Deciding

The sender domain, `centralbranch-library.org`, is consistent with a public
institution — a `.org` ending associated by name with the specific branch
named in the message, checkable against a library card or the branch's
address on a previous visit. There is no link in the message. The 7-day
window is a real operational detail about how long a hold is kept, not a
constructed pressure device — it comes with a plainly stated, unremarkable
consequence, needing to place a new hold, rather than a threat, and the
message does not ask you to click anything, log in anywhere, or provide any
information at all. It only states a status update about an item you
yourself placed on hold. Verdict: legitimate.

---

## What Made the Difference

Across all four, the deciding evidence was never how official a message
looked. Message two and message three both used logos and tone consistent
with their claimed source — that consistency is exactly what makes a message
convincing, and exactly what earlier lessons in this module warned carries
no evidentiary weight on its own. What separated the two legitimate messages
from the two scams was checkable underneath: a sender domain matching a
source already known independently, the presence or absence of a link at
all, whether a link's destination matched its own sender or an unrelated
third domain, and whether the stated deadline was an operational detail or a
manufactured pressure device paired with a threat.

1. A matching, independently verifiable domain is the strongest single piece of evidence, in either direction.
2. A message with no link at all removes an entire category of risk, and several legitimate notices are built this way on purpose.
3. A link's destination can agree with its own sender's domain and still fail the check, if that domain itself is unfamiliar or newly constructed.
4. A deadline attached to an operational detail reads differently from a deadline attached to a threatened loss — both use the word "days" or "hours," but only one is paired with a manufactured consequence.
5. Visual polish and official-sounding names are evidence of effort, not evidence of legitimacy.
