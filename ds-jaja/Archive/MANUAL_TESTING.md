# V1–V3 Manual Testing Checklist

## Required environment setup

1. Enable Email/Password authentication in the configured Firebase project.
2. Set `DSCC_ADMIN_UIDS` to a comma-separated list containing at least one
   Firebase Authentication UID before that account first opens the app.
3. Start the server with `npm start`, sign in as that administrator, and link
   member accounts to stable player records.
4. New registrations must appear as `member`; verify they cannot access event,
   result, audit, participation, user-role, or history-deletion mutations.

## Event and permission checks

- Create a draft battle and verify the previous event is unchanged.
- Duplicate the previous event and verify roster assignments copy while
  availability, confirmation time, attendance, score, and result notes clear.
- Sign in as a linked member and verify a draft is not visible.
- Publish a valid draft and verify the linked member sees My Assignment.
- Try to publish an invalid roster and verify errors block publication.
- Confirm a warning requires an officer reason before publication.
- Progress through published, in-progress, completed, and archived in order.
- Verify an invalid status transition returns a friendly conflict message.
- Attempt to edit another player as a member and expect HTTP 403.
- Edit the same assignment from two sessions and verify the stale session gets
  HTTP 409 with the latest record rather than overwriting it.

## Live and mobile checks

- Open two authenticated sessions; change availability in one and verify the
  other refreshes without pressing Refresh.
- Disconnect and reconnect networking and verify the live status changes.
- At widths below 820px, verify directory rows render as labeled cards without
  horizontal scrolling and My Assignment controls remain touch-friendly.

## Participation and strategy checks

- Archive events containing Present, Late, No-show, and Excused attendance.
- Verify only selected, expected participants affect attendance statistics.
- Filter participation by team and unit.
- Apply a timed strategy template independently to Teams A and B.
- Verify changing a template does not mutate an already-applied event copy.
- Verify each application creates a strategy version and an audit entry.
- Check member timeline filtering shows only the linked member's team.

## Migration and recovery checks

- Confirm `data/state.pre-events-v1.json` contains the pre-migration state.
- Confirm `MIGRATION_REPORT.md` totals match the roster and history.
- Run `npm run migrate:v1` twice and verify event/participant counts do not grow.
- Restore the backup only in a separate test copy and re-run migration.

