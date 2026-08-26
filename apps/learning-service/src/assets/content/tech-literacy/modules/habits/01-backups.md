# Backups Without the Jargon

A backup is a copy of your data, kept somewhere separate from the original,
specifically so that losing the original — to a broken device, a mistaken
deletion, a theft, a fire, a piece of malicious software that scrambles
your files — does not mean losing the data. That's the entire concept. The
rest of this lesson is about doing it in a way that actually holds up when
you need it, because a backup that fails at the moment you need it is
extremely common, and usually fails for a small number of predictable
reasons.

---

## The Idea Behind "3-2-1"

A widely used shorthand for a backup setup that's actually resilient is
"three-two-one": three copies of your data in total, on two different kinds
of storage, with one of those copies somewhere other than your home or
office.

Three copies total means the original plus two backups, not the original
plus one backup. The reasoning is that any single copy — including a
backup — can fail, so a second backup covers the case where your first
backup is the one that turns out to be corrupted or unreadable the day you
need it.

Two different kinds of storage means not keeping both backups on the same
type of device or the same underlying system. An external hard drive and a
cloud storage account are two different kinds. Two external hard drives are
one kind, twice — useful, but both are vulnerable to the same category of
failure, like both being plugged into a computer when it's struck by the
same power surge, or both being in the same bag when it's lost.

One copy not in your house means at least one backup is physically
somewhere else — a cloud service, a drive kept at a relative's house, a
safe-deposit box. This is the part that protects against events that take
out an entire location at once: a fire, a flood, a theft of the whole
premises. A backup sitting next to the computer it's backing up survives a
dead hard drive. It does not survive the house burning down.

You do not need to hit this exactly to be meaningfully protected — one
solid off-site backup, even alone, already covers most of the risk most
people actually face. But the full three-two-one shape is what "well
backed up" means when the phrase is used carefully.

---

## "Backed Up" Is Not the Same as "Synced"

This is the single most common misunderstanding in this area, and it causes
real data loss.

A synced file — through a cloud storage folder that mirrors itself across
your devices — updates everywhere at once. That's the entire point of
syncing: change the file on your laptop, and the same change appears on
your phone and in the cloud, usually within seconds. This is genuinely
useful. It is not a backup, because it doesn't preserve a separate history.
If you delete the file, or it gets corrupted, or malicious software
encrypts it, that change syncs too — the file disappears, or breaks,
everywhere it was synced to, usually just as fast as an intentional edit
would have.

Some sync services do keep a version history or a "trash" you can recover
from for a limited window — worth checking for whatever service you use,
because it changes how much protection the sync actually gives you. But the
default assumption should be: syncing keeps your files available in
multiple places while they're intact, and does not, by itself, guarantee
you can get an old or deleted version back. A backup, properly understood,
means a copy that isn't automatically overwritten or deleted just because
the original was.

---

## What a Working Backup Looks Like Day to Day

For most people, this doesn't need to be complicated. A cloud storage or
backup service that automatically copies your important files on a
schedule, combined with an occasional copy onto a separate physical drive
kept somewhere else, covers the shape described above without requiring
daily attention. What matters more than the specific tools is two habits:
knowing which of your storage is sync and which is genuinely backup, and
periodically confirming the backup actually ran and actually contains
something recoverable, rather than assuming a service is working because
you set it up once. The next lesson in this module gives you a routine for
that confirmation.

---

## When to Actually Test a Restore

A backup that has never been tested is a claim, not a fact. It's common to
discover, only when a restore is actually needed, that a backup has been
silently failing for months — a drive that stopped being recognized, a
cloud account that lost its login, a scheduled job that quietly stopped
running after an update. You don't need to restore everything to catch
this. Occasionally opening one backed-up file from the backup itself,
rather than from the original location, confirms the whole chain is
working: the copy exists, it's current, and it's actually readable.

This matters more the less often you think about your backups day to day.
If the only time you'd discover a failure is the day you desperately need
the data back, the backup has been providing a feeling of safety without
the substance of it. A short test, done occasionally, is what turns that
feeling into something you can actually rely on.

---

## In Short

1. A backup is a separate copy kept specifically to survive the loss of the original.
2. Three-two-one means three total copies, two kinds of storage, one copy off-site.
3. Syncing keeps files available across devices; it is not a backup, because deletions and corruption usually sync too.
4. Check whether your sync service keeps a recoverable version history — it changes how protected you actually are.
5. Know which of your storage is which, and check periodically that backups are actually running.
