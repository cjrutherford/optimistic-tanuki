# When Things Go Down

Something you use every day stops working. The page will not load, the app
spins without finishing, an error appears that means nothing to you. The
first lesson in this module described the trip a request takes; this one is
about what it means when that trip fails, and specifically about telling
apart two very different kinds of failure that produce similarly frustrating
results: your connection failing, and their server failing.

---

## Two Different Failures That Look the Same

From where you sit, a broken connection and a broken server can look
identical: a spinning icon, a blank screen, an error message. But they are
opposite problems, happening in opposite places, and neither one is fixed by
the remedy for the other.

A connection failure means the request from step two of the first lesson
never made it out, or the response never made it back — the trip itself
broke somewhere between your device and the destination. This is usually
about your device, your local network, or your internet provider.

A server failure means the request arrived and either got no response, a
slow response, or an error response, because something is wrong on the
receiving end — the specific computer, or group of computers, that the
service runs on. This has nothing to do with your device or your connection;
you did everything right and the destination could not answer.

---

## Telling Them Apart

The most reliable test is whether anything else on the internet works. If
one specific service will not load but everything else you try loads
normally, the problem is very likely on that service's end, not yours — your
connection is clearly capable of completing requests, since it just did, for
something else. If nothing loads at all, no service, no page, nothing, the
problem is much more likely to be your connection: your device is not
completing the look-up-request-response cycle for anything, which points to
a break close to home rather than a break at one particular distant server.

A second signal is the kind of error you receive. An error that names your
own connection directly — language about being offline, or unable to reach
the internet at all — points to your end. An error that comes back with
recognizable structure, particularly certain well-known signals that mean
"the server received this but something went wrong processing it," is proof
that a response did arrive, which means the request got all the way there
and back. That rules out a connection failure by definition: a connection
that cannot complete a round trip cannot deliver an error message from the
far end.

---

## What "Down" Means on the Other End

When people say a service is "down," they generally mean one of a few
specific things happened to the server side of the system. The server, or
enough of the servers behind a large service, might have crashed or stopped
responding, often during a software update that did not go as planned. The
service might be receiving far more requests than usual — during a major
event, a product launch, or simply a spike in ordinary use — and be too
overloaded to answer every request in a reasonable time, similar to a phone
line that gives a busy signal when every line is occupied rather than being
broken. Or a piece of supporting infrastructure the service depends on, such
as a database, a payment system, or another company's server it relies on
internally, may itself have failed, taking the visible service down with it
even though the part you interact with directly did nothing wrong.

None of these are things you caused, and none of them are things your device
can fix by itself. Restarting your device, checking your settings, or
reinstalling an app addresses problems on your end; it does nothing to a
server that is overloaded or crashed somewhere else, because the request
never gets an answer regardless of how carefully it is sent.

---

## What You Can Actually Do

When a service appears to be down on its own end, waiting is usually the
correct and only response — there is no action available to you that
substitutes for the company fixing their own server. Many companies post a
separate status page, hosted independently of the broken service so that it
stays reachable even when the main service is not, that reports ongoing
problems in close to real time; checking one, if you know it exists for a
given service, is often faster than guessing.

When the problem looks like it is on your end instead, the useful checks are
different: confirming other services work at all, checking whether other
devices on the same connection have the same problem, and, if only one
device is affected, considering whether something local to that device — its
own network settings, or a background process interfering with it — is the
source, rather than the wider connection.

---

## Why the Distinction Matters

Confusing these two failure modes leads to wasted effort in both
directions: restarting a router repeatedly when a distant server is the
actual problem, or waiting patiently for a company to fix something when the
real issue is a local connection problem that a different, simple action
would resolve. The look-up-request-response model from the first lesson in
this module gives you the vocabulary to ask the right question when
something breaks: did my request go out, did it arrive, did anything come
back, and if so, what did it say. Each answer points somewhere different,
and only one of those somewheres is a problem you are equipped to solve
yourself.

---

## Best Practices

1. Test whether other unrelated services work before assuming a problem is yours.
2. Treat an error that names your connection directly as pointing to your end; treat a returned error message as proof the far end was reached.
3. Look for an independently hosted status page before assuming there is no way to check.
4. Do not repeat fixes meant for your own device when the evidence points to the server's end, and vice versa.
