# SaffBuddy

An app for OSU students to find others on campus to pray in congregation with at fixed prayer rooms.

## Language

### Requests

**Request**:
A short-lived public call by one user to pray at a specific room at a chosen start time, which others of the same gender can join.
_Avoid_: Check-in, buddy request, invite

**Requester**:
The user who posted a request. A user belongs to at most one request at a time, as either its requester or a joiner.
_Avoid_: Host, owner, creator

**Join**:
To commit to praying at another user's request. Any number of users can join one request.
_Avoid_: Accept, RSVP

**Joiner**:
A user who has joined a request.
_Avoid_: Buddy, acceptor, attendee

**Start time**:
When the requester will be at the room to pray, chosen only by the requester from a short list of offsets from now.
_Avoid_: Meeting time, prayer time

**In progress**:
The state of a request between its start time and its expiry, when it can no longer be joined.
_Avoid_: Started, live, closed

**Congregation**:
A request that reached its expiry with at least one joiner; the unit SaffBuddy counts in its anonymous usage tallies.
_Avoid_: Prayer, session, match

### Places and people

**Room**:
A fixed, named place on campus where users pray, such as Thompson Library 057.
_Avoid_: Location, prayer spot, spot

**Shared room**:
A room with no gender of its own, used by both men and women. Requests made there are still visible only to the requester's gender.
_Avoid_: Mixed room, unisex room

**Profile**:
A user's first name and gender, set once before they can use the app.
_Avoid_: Account, user info
