# Chat connection status in OT and TS

The shared chat header currently interprets missing participant presence as
Offline. Towne Square also assigns Offline to every conversation contact. A
group or community has no single person whose availability describes whether
the open conversation is connected.

Pass the existing Socket.IO connection lifecycle through both Messages pages
and the community chat wrapper into the shared chat window. For group,
community and project conversations, show Connected, Connecting or Reconnecting
from that transport state. Use the conversation title rather than choosing an
arbitrary participant as its identity. For direct conversations, keep the
participant's explicitly reported availability; absent information is Unknown.

This change adds no active-viewer tracking or participant counts. Connected
describes this client's chat connection, not proof that another person is
currently reading the conversation. Existing audience authorization and session
validation remain the boundary for loading and receiving chat data.

Verify status rendering, input propagation, listener cleanup and connection
transitions with focused component tests. Then exercise real cookie sessions
and the same-origin socket proxy, and use two isolated browser contexts per app
to check a synthetic community with one viewer, two viewers, a disconnected
transport and reconnection. Fixtures must stay within their app scope and use
the supported APIs. Preserve the unrelated Directory work in this checkout.
