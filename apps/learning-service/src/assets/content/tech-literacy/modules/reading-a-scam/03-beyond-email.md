# Texts, Calls and Fake Login Pages

The pressure techniques and impersonation methods covered in the previous
two lessons are not specific to email. They appear in phone calls, text
messages, and web pages, adapted to what each channel makes possible. This
lesson covers those adaptations concretely, including one point that runs
against widely taught advice: a padlock icon and an encrypted connection do
not mean a page is legitimate.

---

## Phone Calls

A phone call claiming to be from your bank, a government agency, or a
technology company's support line uses the same authority lever described
earlier, delivered by a live voice instead of text — often with the added
pressure of a real-time conversation, which gives you less time to think than
a written message you can set aside and reconsider.

The caller ID display, the name or number shown on your phone when a call
comes in, is not reliable evidence of who is calling. The technology that
sets the displayed caller ID information can be configured by the calling
party in ways that are not verified by the phone network, in much the same
way an email's display name is not verified by the email system. A call
displaying a bank's name or a number that matches a bank's known number is
not, by itself, confirmation that the bank is calling.

The reliable check is the same principle as with email: hang up, and call
the organization back using a number you already have from an independent
source — a number printed on a card, a statement, or found by navigating
directly to the organization's own website rather than a number given to you
during the call itself. A legitimate organization's fraud or support
department will not treat a callback through a verified number as an
unreasonable request.

---

## Text Messages

Text messages claiming a package delivery requires action, a payment could
not be processed, or an account needs verification use the same urgency and
authority levers, compressed into a shorter format that leaves less room for
the visible detail available in an email. A text message typically shows only
a short sender ID or number and a link, with none of the surrounding context
an email's full header would show.

The link-destination check from the previous lesson still applies: on most
phones, pressing and briefly holding a link, rather than tapping it directly,
reveals the underlying address before committing to visiting it. Because text
messages are terse by design, and because a sending number is even easier to
present misleadingly than an email address, an unexpected text about a
delivery, payment, or account issue is worth verifying independently — by
opening the relevant app or website directly, rather than through the link in
the text — regardless of how specific or timely the message seems.

---

## Fake Login Pages

A fake login page is a web page built to visually match a real organization's
sign-in page closely enough that a visitor enters their username and password
into it, handing those credentials directly to whoever built the page. Because
the visual design of most login pages — logos, layout, color scheme, field
labels — is public and viewable by anyone who visits the real page, recreating
that design closely is straightforward, and copies are frequently close to
pixel-perfect.

This is the point where common advice needs a direct correction. Many people
are taught to check for a padlock icon in the browser's address bar, or to
confirm the address begins with "https," as a sign that a page is safe. That
padlock and that "https" indicate that the connection between your browser
and the server is encrypted — meaning the data passing between them cannot be
easily read by someone intercepting the connection in transit. That is all
they indicate. They say nothing about who operates the server at the other
end. Obtaining a certificate that enables the padlock and the encrypted
connection is a free, automated process available to anyone who requests one
for a domain they control, including a domain built specifically to run a
fake login page. Most phishing pages encountered today do show a padlock,
precisely because there is no cost or obstacle to obtaining one.

The detail that does carry information is the domain itself — the address
shown in the bar, checked character by character against the real
organization's known domain, using the same lookalike-domain check from the
previous lesson. The padlock confirms encryption. The domain is what
identifies the operator, and only the domain is worth treating as evidence of
legitimacy.

---

## The Common Thread

Across calls, texts, and web pages, the same pattern from the first two
lessons in this module repeats: a display element — caller ID, a sender
number, a page's visual design, a padlock icon — is easy to produce and
proves little on its own, while an underlying, independently checkable
detail — a callback number from a trusted source, the actual link
destination, the literal domain in the address bar — carries the real
information.

---

## Private Browsing Does Not Change Any of This

It is worth addressing a related but separate piece of widely repeated
advice here, since it often comes up in the same conversations as fake login
pages: browsing in a private or incognito window does not provide protection
against any of the techniques in this lesson, and it is not designed to.
Private browsing stops your own browser from saving local history, cookies,
and site data to your device after the window is closed — its purpose is
local, on the device in front of you. It has no effect on what a website you
visit can see, no effect on what your employer's network can observe if you
are using a work or school connection, and no effect on what your internet
provider can see about which sites you connect to. A fake login page is
exactly as convincing, and exactly as able to collect what you type into it,
in a private window as in an ordinary one. Confusing the two — treating
private browsing as a safety measure against deception rather than a local
history setting — is common enough that some browsers now state this
limitation directly when a private window is opened.

1. Caller ID can be set by the calling party and is not verified by the phone network, so it is not reliable evidence of who is calling.
2. The safest check for a call is to hang up and call back using a number from an independent, already-trusted source.
3. Text messages compress the same urgency and authority techniques into a shorter format with less visible detail to check.
4. A padlock icon and "https" mean the connection is encrypted; they do not mean the page or its operator is legitimate, since certificates are free and automatic to obtain.
5. The domain in the address bar, checked character by character, is the detail that actually identifies who operates a page.
6. Private or incognito browsing stops local history from being saved on your device; it does nothing to hide your activity from the sites you visit, your network, or your internet provider.
