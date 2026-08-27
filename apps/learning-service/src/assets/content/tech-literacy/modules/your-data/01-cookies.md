# Cookies, Concretely

A cookie is a small piece of text that a website asks your browser to store,
and to hand back to that same website on every later visit. That is the whole
mechanism. There is no program running, no file that reaches outside the
browser, no way for a cookie to look at anything else on your device. It is a
short string, stored, and returned.

This lesson explains what that simple mechanism enables, and why blocking
cookies is a smaller privacy step than it sounds like.

---

## Why Cookies Exist at All

The technology underneath the web — the connection your browser makes to a
site's server — does not remember you between requests. Each page you load is,
by default, a fresh conversation with no memory of the last one. Load a page,
close it, load it again: as far as the underlying connection is concerned,
that is two strangers, not the same visitor twice.

That amnesia is a problem the moment a site needs to know it is still talking
to the same person. Signing in is the clearest example. You enter a password
once; the site needs some way to recognize you on the next page without
asking again. A cookie solves this: after you sign in, the site sends your
browser a cookie containing an identifier. Your browser stores it and attaches
it to every request it sends back to that site, so the site can look up "this
identifier belongs to this signed-in account" on each page load.

Shopping carts, saved language preferences, and "remember this device" all use
the same mechanism. It is not inherently a tracking technology — it is a
memory technology, and memory is put to different uses.

---

## First-Party and Third-Party Cookies

A first-party cookie is set by the site whose address is in your address bar.
When you sign in to an email provider, the cookie that keeps you signed in was
set by that provider, for that provider. This is the useful case above.

A third-party cookie is set by a different site than the one you are visiting,
usually because that site has embedded something from elsewhere — an
advertisement, a "like" button, a piece of analytics code. That embedded
content can set its own cookie, one belonging to the advertiser or analytics
company, not to the site you meant to visit.

This is where tracking comes from. If the same advertising company's code is
embedded on thousands of unrelated sites, and it sets a cookie with the same
identifier everywhere it appears, that company can observe the same identifier
showing up on a news site, then a retailer, then a forum. It does not know
your name from the cookie alone. It knows that visitor 8f2a91 went to those
three places. Enough of that, over enough sites, builds a detailed profile of
interests and behavior attached to an identifier — one that can later be
linked to a name if you ever sign in anywhere while carrying that identifier.

---

## What Blocking Cookies Actually Blocks

Most browsers let you block third-party cookies, and many now do so by
default. This closes off the specific mechanism described above: an
advertiser's code can no longer set a cookie that follows you from site to
site.

It does not make you unidentifiable, for two separate reasons.

The first is fingerprinting. Your browser and device report a range of
details as an ordinary part of loading any page: screen size, installed
fonts, timezone, language settings, graphics hardware, browser version, and
more. No single detail is unique to you, but the combination often is, in the
same way that a modest set of facts about your car — make, model, colour,
year, license plate region — narrows things down fast. A site can construct
this combination without ever setting a cookie, and use it to recognize a
returning visitor with reasonable accuracy. Blocking cookies has no effect on
this technique, because it never involved a cookie.

The second is account linkage. If you sign in to the same account from two
different devices, or if you use a "sign in with" button that connects one
company's account to another site, the connection is now made directly
through the account system, not through a cookie. This is a deliberate,
visible design in most cases — but worth naming, because "I blocked cookies"
can create a sense of anonymity that account sign-in quietly overrides.

---

## What a Cookie Cannot Do

It is worth being precise about the limits, since overstating a risk is as
misleading as understating one. A cookie cannot read files on your device. It
cannot see what is in other browser tabs unless those tabs belong to the same
site. It cannot install anything. It is a string of text, sent back to the
site that set it, and nothing more. The privacy question is not about what a
single cookie can do — it is about what can be inferred from the pattern of
where a persistent identifier keeps appearing.

---

## Deciding What to Do

Browsers generally offer a few levels of control: allow all cookies, block
third-party cookies while keeping first-party ones, or block all cookies. The
middle option preserves the useful behavior — staying signed in, keeping a
cart — while removing the most common cross-site tracking mechanism. Blocking
all cookies tends to break sign-in on many sites, since even first-party
sign-in relies on the same mechanism.

Because fingerprinting operates independently of cookies, a browser setting
that specifically resists fingerprinting, where one exists, addresses a
different part of the problem than the cookie setting does. The two are
worth thinking of as separate controls, not one problem with one switch.

---

## Cookies Also Expire, or Do Not

A cookie can be set with an expiration date, after which the browser
discards it on its own, or it can be set to persist until you or the site
removes it. A "session cookie" is discarded when you close the browser
window entirely, and is the type most often used for the temporary state
needed while filling out a multi-page form or completing a purchase. A
"persistent cookie" survives across sessions, deliberately, because staying
signed in across separate visits requires exactly that. Neither type is
inherently more or less related to tracking than the other — a persistent
cookie storing a language preference is no more concerning than a session
cookie, and a third-party tracking cookie can in principle be set to expire
quickly or to last for years, depending on how the company that set it
chose to configure it. The distinction that matters for tracking is
first-party versus third-party, not session versus persistent.

Most browsers let you view and individually delete stored cookies, listed
by the domain that set them, in a settings page usually labelled something
like "cookies and site data." Reviewing this list occasionally shows,
concretely, how many different domains have set cookies through sites you
visited directly — often a far larger number than the sites you remember
visiting on purpose, since most of them arrived through embedded third-party
content rather than a deliberate visit.

1. A cookie is a small piece of text your browser stores and returns to a site on request.
2. First-party cookies mostly enable useful memory, like staying signed in.
3. Third-party cookies, set by embedded content from other companies, enable cross-site tracking.
4. Blocking third-party cookies stops that specific mechanism; it does not stop fingerprinting or account-based linkage.
5. Treat "block cookies" and "resist fingerprinting" as two different settings, because they address two different techniques.
