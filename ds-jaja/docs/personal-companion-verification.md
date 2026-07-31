# Personalized Companion Architecture and Verification

## Architecture

- `src/textSanitization.js` sanitizes display text at request, persistence, import/OCR, and DOM rendering boundaries without changing identifiers, URLs, timestamps, or encoded images.
- `src/personalCompanion.js` owns private journal and goal normalization, goal timing, and idempotent achievement creation.
- `src/dataStore.js` derives private client data from the authenticated UID. It never returns another user's journal, goals, or achievements, including to leadership users.
- My Briefing derives current operational cards from source records. Only private state that needs history, read state, or dismissal is persisted.
- Automatic goal progress runs only from published VS scores or archived participation. A goal switched to manual progress is not overwritten.
- Recurring goals retain the prior occurrence in history and create one idempotent future occurrence.

## Private and shared data

Current server-managed state:

- `appState/current/userJournals/{uid}`
- `appState/current/userGoals/{uid}`
- `appState/current/userAchievements/{uid}`
- `appState/current/achievementDefinitions`
- `appState/current/privateMigrationBackups/journal-v1`
- `appState/current/privateDataQuarantine`

Owner-scoped paths reserved by `database.rules.json` for compatible direct-client use:

- `userPrivate/{uid}/journalEntries/{entryId}`
- `userPrivate/{uid}/goals/{goalId}`
- `userPrivate/{uid}/achievements/{achievementId}`
- `userPrivate/{uid}/briefingState/{itemId}`
- `userPrivate/{uid}/reminders/{reminderId}`

Direct reads and writes to `appState` remain denied. The trusted Node server applies authenticated UID and role checks.

## Migration and rollback

The administrator endpoint is `POST /api/admin/migrate-private-data`.

1. Run `{ "dryRun": true }`.
2. Confirm `quarantinedEntries` is zero or investigate every quarantined owner.
3. Capture the live state fingerprint and record counts.
4. Run `{ "dryRun": false }`.
5. Confirm the response includes `backupKey: "journal-v1"`.
6. Compare entry IDs, titles, bodies, and original timestamps with `privateMigrationBackups/journal-v1`.
7. Confirm a second dry run reports zero changed entries.

The backup is server-only and is not included in client state. Do not remove it until post-deployment verification succeeds.

## Automated verification

Run:

```powershell
npm.cmd test
npm.cmd run check
```

Coverage includes:

- owner-derived journal identity and cross-user goal scoping;
- Firebase owner rules;
- daily and configured VS-week timing;
- recurring goal rollover and missed-goal history;
- automatic VS, attendance, and confirmation progress with stable manual overrides;
- Theme, VS daily, and VS weekly top-three idempotency;
- final-result gating;
- maintenance route placement and event-archive automation placement;
- OCR and persistence sanitation.

## Manual checklist

- Sign in as a member and confirm My Briefing is the initial page.
- Create, edit, search, date-filter, pin, duplicate, archive, restore, and delete a journal entry.
- Attach and detach multiple goals; delete either side and verify the other record survives.
- Set a journal reminder, trigger it, open the journal, and dismiss the reminder.
- Create daily, weekly, VS, and event goals; edit, pause, reopen, complete, and delete each.
- Check Today, This Week, VS Week, Event Goals, and Completed goal tabs.
- Publish a reviewed VS day and verify daily progress and private achievements.
- Publish all VS days and verify weekly totals, records, improvement, thresholds, and complete-submission awards.
- Finalize Theme Week and verify placement, participant, first-submission, streak, and improvement awards.
- Archive a battle and verify automatic attendance and confirmation goals.
- Switch an automatic goal to manual, publish new source data, and verify the manual value is retained.
- Dismiss an achievement and confirm it remains in Achievement History.
- Verify another member profile never displays private goals or journal content.
- Verify private-message unread count, priority, read state, and reply navigation.
- Verify an administrator can preview achievement rules and maintenance actions; verify members cannot.
- At 360, 390, 768, 1024, and 1440px, check the authenticated briefing, journal, goal editor, events, roster panel, and administration pages for overflow and keyboard access.
- Confirm live-event updates appear without a page reload.

## Remaining operational risks

- Firebase rule deployment changes the live security boundary and must be explicitly approved.
- The live private-data migration changes one existing journal record and must be explicitly approved after its dry run.
- Full authenticated browser screenshots require an account signed in to the local application origin.
