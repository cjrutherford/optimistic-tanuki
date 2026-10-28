# Community chat identity and sending

Towne Square embeds the shared community chat inside a page whose route does
not resolve a chat actor. The shared component previously depended on that
route data, so it rejected submissions locally before emitting a Socket.IO
message. Supply the authenticated profile explicitly when embedding the chat,
and retain route resolution for routed consumers. An explicit empty identity
must clear the view rather than fall back to another actor.

Profile changes clear room state, replace socket listeners and invalidate
pending loads. Community ownership compares the owner profile with the acting
profile, not an account ID. OT's community resolver likewise uses the current
session profile instead of a possibly older stored selection. Server-side
session binding, approved membership and message persistence remain required.

The reported legacy OT community had an approved membership recorded against
the same account's old global profile. A separate, explicit local repair
verifies both profiles' account ownership, locks the relevant records and
updates only approved legacy bindings. It preserves roles, approval status,
counterparts and history, with private before/after records. A missing legacy
room is provisioned under its independently verified existing owner; public
visibility alone grants neither membership nor management authority.

Verification must exercise the actual community chat routes and embedded tab,
not only the Messages inbox or a connection badge. Both apps must send and
receive real messages in both directions, clear acknowledged drafts and show
persisted messages under the session's profile. An unjoined public-community
visitor must still be denied room access until approved membership exists.
