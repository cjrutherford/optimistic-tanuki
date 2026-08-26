# What a Server Actually Is

The previous lesson described a request going out and a response coming
back, without saying much about what sends the response. This lesson is
about that: a server. The word gets used loosely, sometimes to mean a piece
of software, sometimes an entire building, sometimes a vague stand-in for
"the internet." The concrete version underneath all of those uses is simple:
a server is a computer, owned by someone, that stays on and answers requests.

That is the whole definition. It is not a special category of hardware
inherently different from the device you are reading this on — the
difference is the job it does and how it is set up to do it. A server is
built to stay running continuously, to accept requests from many people at
once, and to be reachable at a stable address so that lookups (the first
step from the previous lesson) keep resolving to the right place.

---

## "The Cloud" Is Not a Metaphor for Anything Magic

"The cloud" is a marketing-friendly name for servers you do not own,
maintained by a company, that you reach over the internet instead of over a
cable in your own building. When a photo is "backed up to the cloud," the
photo has been sent, as a response to a request, to a physical hard drive
inside a physical computer inside a building somewhere, owned and operated by
a specific company, subject to that company's decisions about who can look
at it, how long it is kept, and what happens if the company goes out of
business.

This is not a criticism of the arrangement — storing your data on a server
run by a company that specializes in reliably storing data is frequently a
better bet than storing it only on your own device, which can be lost,
stolen, or broken. It is worth stating plainly what is actually happening,
because "the cloud" as a phrase is designed to sound like it isn't a place,
and it is a place: rows of computers in a facility, owned by an entity, with
policies.

---

## Somebody Pays for It

A server does not run for free. Electricity, the physical space it sits in,
the internet connection it uses, and the staff who keep it working all cost
money on an ongoing basis, not as a one-time purchase. Every free service you
use is being paid for by someone — through advertising shown to you, through
data about your usage sold or used internally, through a paid tier that other
users buy, or through a company treating the free version as an investment in
future paying customers. "Free" describes what you pay, not what it costs to
run.

This is useful to know when you are deciding whether to trust a service with
something sensitive. The question worth asking is not "is this free," but
"who is paying for this, and what are they getting in return for giving it
to me at no charge." Sometimes the honest answer is straightforward — a
company selling a subscription product offers a limited free tier to attract
customers. Sometimes the answer is that your attention or your data is the
product being sold to someone else. Both arrangements are common and neither
is automatically a problem; the point is that one of them is happening.

---

## Somebody Can See What Is on It

A server is administered by people — engineers and operators who can, as
part of doing their jobs, access the computer and the data stored on it.
This is different from saying they routinely read your files; most
organizations have policies, and often legal obligations, restricting casual
access to user data. But the technical capability exists at a level your own
use of the service does not reach. When you delete something from an app, you
are usually asking the server to delete its copy — you are not personally
reaching in and erasing it, and the server's owner decides how that deletion
request is actually carried out, including whether a copy persists in a
backup for some period afterward.

Encryption — a way of scrambling data so it is unreadable without a specific
key — changes this picture in an important way, but not a total one. Data
protected this way in transit (while traveling as a request or response) is
unreadable to anyone intercepting it along the route. Data that is also
encrypted at rest (while stored on the server) is unreadable to someone who
merely gains access to the storage without the key. But if the service itself
holds the key, as most consumer services do, the service's own staff and
systems can still read the data when needed to operate the product — for
example, to show it back to you when you log in. A smaller number of services
use an approach where even the provider cannot read your data, usually
described explicitly as "end-to-end encrypted," and that phrase is doing real
work when a service uses it correctly; most services do not.

---

## One Server, Many Requests

A single server can answer requests from thousands or millions of people
without those people ever being aware of each other. This is possible
because each request is self-contained — it identifies what it is asking for
and, when relevant, who is asking — and the server processes them one after
another or in parallel, keeping them separate. Large services rarely run on
literally one machine; they spread the work across many, with additional
computers to divide incoming requests between them, but from your side of a
request, the distinction is invisible and does not need to be tracked.
What matters is the underlying idea: a service is not a place that "has" your
session open and waiting for you the way a store has a chair out. It is a
machine that answers a fresh request, this one and the next one, based on
information the request carries with it.

---

## Why This Matters Day to Day

Knowing that a server is a specific, owned, administered computer changes how
a few common situations read. A service going offline is not an abstract
weather event; it is a specific machine, or a specific piece of software on
it, failing, and someone at the company is being paged about it. A company
being acquired or shutting down is not just a business headline; it is a
question of what happens to the physical machines holding your data and who
inherits control of them. A privacy policy is not boilerplate; it is, in
part, a description of what the people who run that particular server are
allowed to do with what is stored on it.

None of this requires distrust as a default. It requires treating "a server"
as a concrete thing with an owner, rather than an abstraction that data
simply floats into.

---

## Best Practices

1. Replace "the cloud" in your own thinking with "someone else's computer" — it is accurate and it clarifies the stakes.
2. When a service is free, ask what is funding it before assuming there is no cost to you.
3. Read for the phrase "end-to-end encrypted" specifically; plain "encrypted" usually still leaves the provider able to read your data.
4. Remember that deleting something asks the server to delete it — it does not guarantee the deletion is instant or total.
