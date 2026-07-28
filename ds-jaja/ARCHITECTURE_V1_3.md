# Desert Storm Command Center — V1–V3 Architecture

## Current architecture assessment

The application is a vanilla browser ES-module client served by a Node `http`
server. Firebase Email/Password Authentication supplies ID tokens. The server
validates tokens with Firebase Identity Toolkit, but application data is stored
in `data/state.json`; Firebase Realtime Database is not currently the data
source despite its URL being present in the browser configuration.

`public/app.js` renders all authenticated views and calls JSON API routes.
`server.js` authenticates requests and delegates persistence to
`src/dataStore.js`. The data store caches and rewrites the whole JSON document.
OCR result import is isolated in `src/resultScreenshotReader.js`.

## Current files and responsibilities

- `server.js`: static hosting, authentication, API routing, upload parsing.
- `src/dataStore.js`: state normalization, validation, mutation, persistence.
- `src/resultScreenshotReader.js`: screenshot OCR and roster-name matching.
- `public/auth.js`: Firebase sign-in/registration session handling.
- `public/app.js`: API client, view state, rendering, interactions.
- `public/index.html`: authenticated application shell.
- `public/styles.css`: application and authentication presentation.
- `public/login.*`, `public/register.*`: account entry flows.
- `data/state.json`: shared roster, current-week state, and battle history.

## Current data and API flow

The browser sends its Firebase ID token to the Node server. The server verifies
it with Identity Toolkit, loads a cached state document, applies a mutation,
and rewrites `data/state.json`. Other clients only see changes after their next
request or manual refresh. Current team, availability, assignment, attendance,
and score values live on master member records.

## Security and reliability risks

- Any authenticated account can currently perform every mutation.
- Self-registration creates an account with effective officer access.
- ID tokens are not refreshed before expiry.
- Roles and user-to-player links do not exist.
- Whole-state writes can silently overwrite concurrent edits.
- Important changes have no audit record.
- File-backed persistence cannot provide native cross-instance live updates.
- Historical deletion and correction need explicit administrator controls.

## Migration risks

- Current transient player fields must be captured in a draft event before
  being removed from permanent player data.
- Archived player snapshots may contain names without stable IDs.
- Imported results may not correspond to a selected current player.
- Existing counters may not agree with archived records.
- Deployment must retain a backup and make repeated migration runs idempotent.

## Target schema

The file-backed implementation mirrors the eventual Firebase paths:

```text
users/{uid}
players/{playerId}
events/{eventId}
eventParticipants/{eventId}/{playerId}
strategyTemplates/{templateId}
eventStrategies/{eventId}/{team}
strategyVersions/{eventId}/{team}/{versionId}
auditLogs/{eventId}/{logId}
systemSettings
migrations/{migrationId}
```

Records carry `updatedAt` and integer `version` fields for optimistic
concurrency. API mutations are targeted and role checked. The browser uses a
lightweight event stream for live updates while the file store remains in use;
the same domain model can later be moved path-for-path to Realtime Database.

## Implementation milestones

1. Add normalized users, players, events, participants, permissions, migration,
   and audit primitives.
2. Add event lifecycle, duplication, publishing, My Assignment, availability,
   token refresh, and live event updates.
3. Add publish validation, version conflict handling, audit UI, mobile cards,
   and officer event management.
4. Calculate participation analytics and player history from event records.
5. Add strategy templates, timed phases, responsibilities, application,
   timelines, debriefs, and immutable strategy versions.
6. Add automated domain/API tests and a manual Firebase/deployment checklist.

## Expected changed and new files

- Change: `server.js`, `src/dataStore.js`, `public/auth.js`, `public/app.js`,
  `public/index.html`, `public/styles.css`, `public/register.*`, `README.md`,
  `package.json`.
- Create: `src/domain.js`, `src/permissions.js`, `src/validation.js`,
  `scripts/migrate-v1-events.js`, `test/domain.test.js`,
  `MIGRATION_REPORT.md`, `MANUAL_TESTING.md`.

