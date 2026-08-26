# What the Cloud Is

"The cloud" describes a computer that is not yours, sitting in a building you
will never see, owned and operated by a company, doing work on your behalf
over an internet connection. That is the entire concept. The word suggests
something diffuse and weightless; the reality is a specific, physical,
owned machine.

This lesson replaces the metaphor with the mechanism, because the mechanism
determines who can see what you store there and under what conditions.

---

## A Building, Not a Weather Pattern

A "cloud" service runs on a data center: a building full of computers,
cooling systems, and backup power, operated by staff, connected to the
internet by physical cables. When you save a document "to the cloud," the
document is copied over a network connection to a computer in one of these
buildings, owned by the company whose service you are using.

That company pays for the building, the power, the cooling, the network
connection, and the staff who keep the machines running. This is not a
criticism — it is the plain economic fact that explains why cloud storage is
rarely free at scale, why companies want you signed in to use it, and why the
service can disappear if the company stops operating it.

The data center itself is often owned by a different company than the one
whose name is on the service you use. A wide range of well-known
applications lease computing space from a smaller number of large data-center
operators. Your files may physically sit on hardware owned by a company you
have never directly interacted with, operating under a contract with the
company you did sign up with.

---

## Who Can See What You Store There

Several distinct parties are relevant, and they have different levels of
access for different reasons.

The company operating the service you signed up for can generally access
data stored on its systems, to the extent its own engineering design allows.
Some services use encryption designed so that only you hold the key needed
to read your data — this is usually described explicitly, using terms like
"end-to-end encryption," because it is a meaningful design choice and
companies that implement it tend to advertise it. Absent that specific
design, assume the operating company can technically access what is stored,
even if its policy states that employees do not do so routinely.

Employees of that company, in the ordinary course of maintaining the service,
may have access — for debugging, for responding to a support request you
initiated, or for legally mandated investigations. Access for these reasons
is typically logged and restricted internally, according to the company's own
stated policies, which are again worth reading rather than assuming.

Governments and courts can compel a company to disclose stored data, through
legal processes that vary by country and by the nature of the request. A
company's transparency report, where one is published, typically states how
many such requests it received and how many it complied with — concrete
numbers, worth checking if this matters to you, rather than a general fear.

The company's own security failures are a further, distinct risk: data
stored anywhere can be exposed if that party is breached, independent of its
policies or intentions.

---

## Why This Differs From Local Storage

Storing a file only on a device you physically hold means access requires
either physical possession of that device or a way to reach it over a
network the device is connected to. Storing the same file in the cloud adds
a permanent party with routine technical access: the company operating the
service. This is a trade, not a straightforward downgrade — cloud storage
typically offers backup against device loss, access from multiple devices,
and recovery if a password is forgotten, none of which local-only storage
provides on its own. The decision is about which set of risks and
conveniences suits a given piece of information, made case by case rather
than as a blanket rule.

---

## Legal Obligations Are Not Uniform

Where a data center is physically located, and where the operating company is
legally based, affects which country's laws govern access requests to it.
This is why some companies let you choose a storage region, and why some
services publish separate policies for different countries. There is no
single global rule to state here — the specific answer depends on the
service and the jurisdiction, and checking a service's own published policy
is the only reliable way to know which laws apply to your data with that
provider.

---

## A Concrete Way to Evaluate a Cloud Service

Before storing something sensitive with a new service, three questions give a
concrete picture: does the company describe end-to-end encryption for this
specific type of data, does it publish a transparency report describing
government requests it receives, and does its policy state how long data is
retained after you delete it. All three are usually answerable from the
company's own published materials, without needing to trust a summary from
anyone else.

---

## "Deleted" Is Worth Checking Too

Deleting a file from a cloud service, from your side, usually removes it
from what you can see and access. Whether it is removed from the company's
underlying storage immediately, or retained for some further period on
backup systems before being permanently erased, varies by service and is
generally stated, if it is stated at all, in the same policy documents
discussed above. A gap between "deleted from my view" and "actually erased
from every copy" is common and not necessarily concerning on its own — backup
systems that retain recently deleted data for a defined period are often
what allows recovery from an accidental deletion — but it is a gap worth
knowing about specifically for anything you would want irreversibly gone,
rather than assuming deletion is instant and total by default.

---

## A Company Going Out of Business or Changing Its Terms

A further, distinct consideration is what happens to stored data if the
operating company stops offering the service, is acquired by another
company, or changes its terms after you have already stored data with it.
Some services commit, in writing, to a notice period and an export option
before shutting down a product; others do not state anything specific about
this scenario at all. This is not a reason to avoid cloud storage generally
— it is a reason to treat "can I get my data out, in a usable form, if this
changes" as one more concrete question worth answering before committing
something to a service you intend to rely on over time.

1. The cloud is a company's computer in a data center, not an abstract or ownerless space.
2. The operating company can generally access what is stored unless the service specifically uses end-to-end encryption.
3. Employees, courts, and governments are each separate, distinct parties with their own access routes.
4. Cloud storage trades a new party with routine access for backup, multi-device access, and recovery.
5. A service's own transparency report and encryption claims are the concrete sources to check, not general reputation.
