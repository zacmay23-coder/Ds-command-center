# Future My Messages handoff

The Ewar Dashboard no longer renders private conversations. Existing private-message data and APIs remain unchanged.

## Existing storage and access

- Stored state: `privateMessages` in the application data store and Firebase-backed state.
- Message fields: `id`, `senderUid`, `recipientUid`, `text`, `priority`, `readAtByRecipient`, and `createdAt`.
- Client state only returns messages where the authenticated user is the sender or recipient.
- `markPrivateMessageRead` only resolves records whose `recipientUid` matches the authenticated user.
- Database rules continue to restrict private user data by authenticated UID.

## Existing functions and routes

- `sendPrivateMessage` via `POST /api/private-messages`
- `markPrivateMessageRead` via `PATCH /api/private-messages/:id/read`
- `api.sendPrivateMessage`
- `api.markPrivateMessageRead`
- `publicPrivateMessage` client projection

## Future profile integration

Add a `My Messages` panel under the signed-in member profile with:

1. Conversation list grouped by the other participant.
2. Per-conversation unread count.
3. Selected conversation history.
4. Composer using the existing send route.
5. Read receipt updates using the existing read route.
6. A profile-level `Send Message` action for other registered members.

Conversation access must continue to be derived from the authenticated UID on the server. Do not accept a client-provided owner UID or expose messages to officers merely because of their role.
