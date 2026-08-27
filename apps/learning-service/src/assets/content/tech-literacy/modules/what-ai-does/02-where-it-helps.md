# Where It Is Genuinely Useful

The previous lesson described the mechanism: a chatbot generates the
statistically likely continuation of text, without by default checking
anything against a source of truth. That mechanism is not a flaw to be
worked around in every case. It is well matched to a specific category of
work, and poorly matched to another. This lesson stays in the first
category — tasks where generating plausible, well-formed text is exactly
what you need, and where you are equipped to judge the result yourself.

---

## Drafting Something From a Blank Page

A blank page is a specific kind of obstacle: not that you lack the
knowledge to write the thing, but that starting cold is harder than
revising something that already exists. Asking a chatbot to produce a first
draft of an email, a set of meeting notes, a policy paragraph, or a project
update gives you something to react to instead of something to originate.

You read the draft the way you would read a colleague's rough draft: not as
a finished product, but as a starting point you will change. This works
well precisely because you already know what the email needs to say — you
are supplying the judgment, the tool is supplying the sentences.

---

## Rephrasing and Adjusting Tone

Taking a paragraph you've already written and asking for it in a different
register — more formal, shorter, suitable for a general audience instead
of a technical one — is a task the model handles well. The content
originates with you. The model is doing what it's structurally good at:
producing plausible variations of a piece of text, restructured to fit a
different style.

This is also useful for translation-adjacent tasks — turning something
dense into something a specific reader will actually get through — with
the same caveat as everywhere else: you are the one who can tell whether
the meaning survived the rewrite, so read the result rather than trusting
that it did.

---

## Summarizing Something You Can Check Against the Original

Asking for a summary of a long document is useful precisely when you also
have the document, or can get it, and can spot-check the summary against
it. A summary you cannot verify is a summary you are trusting blindly, and
that returns you to the fluency problem from the previous lesson: an
inaccurate summary is written with exactly the same confidence as an
accurate one.

Used well, this looks like: you have a fifteen-page report, you need the
three main points before a meeting in ten minutes, you ask for a summary,
you skim the original afterward to see if the summary's claims are actually
in there. Used poorly, it looks like: you never open the original at all,
and treat the summary as the source rather than as a shortcut into the
source.

---

## Getting Unstuck, Not Getting Answers

There is a particular kind of stuck that isn't about missing facts — it's
about not knowing where to start structuring a plan, an argument, or a
document. "What are some ways to organize a training session for new
staff" or "what sections does a typical vendor comparison document have"
are questions where a plausible-sounding answer is often genuinely useful,
because you are asking for structure and convention, not verified facts.
Convention is exactly the kind of pattern a language model has absorbed at
scale, from having read a great many examples of the thing you're asking
about organizing.

The output here is a set of options to choose from and adapt, not an
instruction to follow. Treat it as a colleague thinking out loud, offering
possibilities, some more useful than others.

---

## Explaining a Concept You Can Then Verify

Asking a chatbot to explain an unfamiliar term or concept works well as a
first pass, provided you treat the explanation as a hypothesis rather than
a settled fact, especially for anything specific — numbers, dates, named
individuals, exact procedures. A good use of this pattern: you encounter an
unfamiliar term in a document at work, ask what it means, get a plausible
explanation, and then check that explanation makes sense in context or
against one other source before repeating it to someone else.

This is different from asking it to be your only source on something that
matters — a legal question, a medical question, a number you're going to
put in front of your manager. For those, the explanation is a way to get
oriented quickly, not a substitute for the source you'd normally check.

---

## The Pattern Across All of These

Every example above shares a structure: the model produces something, and
you are positioned to judge whether it's right, because either the content
originated with you, or you have the original to check against, or you're
asking for structure and convention rather than a specific fact, or you
intend to verify before it matters. That positioning is the actual skill
this course is building — not "trust it" or "don't trust it," but knowing,
before you ask, whether you'll be able to tell if the answer is wrong.

The next lesson looks at what happens when that positioning is missing —
when the question asked for a specific fact, and nothing about the
situation would tell you if the answer were confidently wrong.

---

## In Short

1. Drafting works well because you supply the judgment and the tool supplies the sentences.
2. Rephrasing and tone changes work well because the content and its accuracy both stay under your control.
3. Summarizing is safe when you can and do check the summary against the original.
4. Getting unstuck on structure and convention plays to what the model has actually absorbed at scale.
5. The common thread is verifiability — use it where you're equipped to catch a wrong answer.
